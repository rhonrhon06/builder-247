import { Request, Response, NextFunction } from 'express';
import { v4 as uuidValidate, version as uuidVersion } from 'uuid';
import { performance } from 'perf_hooks';
import winston from 'winston';

// Create a specialized logger for transaction tracking
const transactionLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/transaction-validation.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Transaction Uniqueness Service with concurrent tracking
class TransactionUniquenessService {
  private processedTransactions: Set<string> = new Set();
  private maxTransactionLifetime: number; // ms

  constructor(maxLifetime: number = 3600000) { // Default 1 hour
    this.maxTransactionLifetime = maxLifetime;
  }

  isUnique(transactionId: string): boolean {
    if (this.processedTransactions.has(transactionId)) {
      return false;
    }
    this.processedTransactions.add(transactionId);
    
    // Auto-cleanup mechanism
    setTimeout(() => {
      this.processedTransactions.delete(transactionId);
    }, this.maxTransactionLifetime);

    return true;
  }
}

const uniquenessService = new TransactionUniquenessService();

// Middleware for comprehensive Transaction ID validation
export const validateTransactionId = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const transactionId = req.headers['x-transaction-id'] as string;

  // Initial presence check
  if (!transactionId) {
    const error = {
      code: 'MISSING_TRANSACTION_ID',
      message: 'Transaction ID is required in x-transaction-id header'
    };
    
    transactionLogger.error({
      type: 'VALIDATION_ERROR',
      error: error,
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(400).json(error);
  }

  // Validate UUID format (v4)
  if (!uuidValidate(transactionId) || uuidVersion(transactionId) !== 4) {
    const error = {
      code: 'INVALID_TRANSACTION_ID_FORMAT',
      message: 'Transaction ID must be a valid UUID v4'
    };

    transactionLogger.warn({
      type: 'FORMAT_VALIDATION_ERROR',
      transactionId,
      error: error,
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(400).json(error);
  }

  // Check transaction uniqueness
  if (!uniquenessService.isUnique(transactionId)) {
    const error = {
      code: 'DUPLICATE_TRANSACTION_ID',
      message: 'This transaction has already been processed'
    };

    transactionLogger.warn({
      type: 'DUPLICATE_TRANSACTION',
      transactionId,
      error: error,
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(409).json(error);
  }

  // Attach transaction details to request
  req.transactionId = transactionId;

  // Performance tracking
  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Log successful validation with performance metrics
  transactionLogger.info({
    type: 'TRANSACTION_VALIDATED',
    transactionId,
    processingTime,
    requestPath: req.path,
    clientIp: req.ip
  });

  // Performance constraint check (100ms)
  if (processingTime > 100) {
    transactionLogger.warn({
      type: 'HIGH_LATENCY',
      transactionId,
      processingTime,
      message: 'Transaction validation exceeded 100ms threshold'
    });
  }

  next();
};
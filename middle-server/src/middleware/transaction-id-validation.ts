import { Request, Response, NextFunction } from 'express';
import { v4 as uuidValidate, version as uuidVersion } from 'uuid';
import { performance } from 'perf_hooks';
import winston from 'winston';

// Create a logger for transaction tracking
const transactionLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'transaction-errors.log' }),
    new winston.transports.Console()
  ]
});

// Uniqueness check service (mock implementation, to be replaced with actual service)
class TransactionUniquenessService {
  private processedTransactions: Set<string> = new Set();

  isUnique(transactionId: string): boolean {
    if (this.processedTransactions.has(transactionId)) {
      return false;
    }
    this.processedTransactions.add(transactionId);
    return true;
  }
}

const uniquenessService = new TransactionUniquenessService();

/**
 * Middleware for Transaction ID Validation
 * 
 * Validates:
 * - Transaction ID presence
 * - Transaction ID format (UUID v4)
 * - Transaction ID uniqueness
 * 
 * Measures and logs middleware processing time
 */
export const validateTransactionId = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const transactionId = req.headers['x-transaction-id'] as string;

  // Check if Transaction ID is present
  if (!transactionId) {
    const error = {
      error: 'Transaction ID is required',
      message: 'x-transaction-id header must be provided'
    };
    
    transactionLogger.error({
      type: 'MISSING_TRANSACTION_ID',
      timestamp: new Date().toISOString(),
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(400).json(error);
  }

  // Validate Transaction ID is a valid UUID v4
  if (!uuidValidate(transactionId) || uuidVersion(transactionId) !== 4) {
    const error = {
      error: 'Invalid Transaction ID',
      message: 'Transaction ID must be a valid UUID v4'
    };

    transactionLogger.error({
      type: 'INVALID_TRANSACTION_ID_FORMAT',
      transactionId,
      timestamp: new Date().toISOString(),
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(400).json(error);
  }

  // Check Transaction ID uniqueness
  if (!uniquenessService.isUnique(transactionId)) {
    const error = {
      error: 'Duplicate Transaction ID',
      message: 'This transaction has already been processed'
    };

    transactionLogger.warn({
      type: 'DUPLICATE_TRANSACTION_ID',
      transactionId,
      timestamp: new Date().toISOString(),
      requestPath: req.path,
      clientIp: req.ip
    });

    return res.status(409).json(error);
  }

  // Attach transaction ID to request
  req.transactionId = transactionId;

  // Log successful validation
  const endTime = performance.now();
  const processingTime = endTime - startTime;

  // Check processing time constraint (100ms)
  if (processingTime > 100) {
    transactionLogger.warn({
      type: 'HIGH_LATENCY',
      transactionId,
      processingTime,
      timestamp: new Date().toISOString()
    });
  }

  transactionLogger.info({
    type: 'TRANSACTION_VALIDATED',
    transactionId,
    processingTime,
    timestamp: new Date().toISOString()
  });

  next();
};
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidValidate } from 'uuid';

/**
 * Middleware to validate Transaction ID
 * 
 * This middleware checks:
 * 1. Transaction ID is present in headers
 * 2. Transaction ID is a valid UUID v4
 */
export const validateTransactionId = (req: Request, res: Response, next: NextFunction) => {
  const transactionId = req.headers['x-transaction-id'] as string;

  // Check if Transaction ID is present
  if (!transactionId) {
    return res.status(400).json({
      error: 'Transaction ID is required',
      message: 'x-transaction-id header must be provided'
    });
  }

  // Validate Transaction ID is a valid UUID v4
  if (!uuidValidate(transactionId)) {
    return res.status(400).json({
      error: 'Invalid Transaction ID',
      message: 'Transaction ID must be a valid UUID v4'
    });
  }

  // Attach transaction ID to request for downstream use
  req.transactionId = transactionId;

  next();
};
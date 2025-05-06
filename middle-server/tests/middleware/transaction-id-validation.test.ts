import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateTransactionId } from '../../src/middleware/transaction-id-validation';
import winston from 'winston';

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  })),
  format: {
    json: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

describe('Transaction ID Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      path: '/test-path',
      ip: '127.0.0.1'
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should reject request without Transaction ID', () => {
    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Transaction ID is required'
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid Transaction ID', () => {
    mockRequest.headers = { 'x-transaction-id': 'invalid-uuid' };

    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Invalid Transaction ID'
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow request with valid unique Transaction ID', () => {
    const validUuid = uuidv4();
    mockRequest.headers = { 'x-transaction-id': validUuid };

    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockRequest.transactionId).toBe(validUuid);
  });

  it('should reject duplicate Transaction ID', () => {
    const duplicateUuid = uuidv4();
    mockRequest.headers = { 'x-transaction-id': duplicateUuid };

    // First call - should pass
    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    // Reset mocks
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();

    // Second call with same UUID - should fail
    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Duplicate Transaction ID'
    }));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should log validation events', () => {
    const validUuid = uuidv4();
    mockRequest.headers = { 'x-transaction-id': validUuid };

    validateTransactionId(
      mockRequest as Request, 
      mockResponse as Response, 
      mockNext
    );

    // Verify logging occurs
    const mockLogger = winston.createLogger();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TRANSACTION_VALIDATED',
      transactionId: validUuid
    }));
  });
});
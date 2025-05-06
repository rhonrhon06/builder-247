import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateTransactionId } from '../../src/middleware/transaction-id-validation';

describe('Transaction ID Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      headers: {}
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

  it('should allow request with valid Transaction ID', () => {
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
});
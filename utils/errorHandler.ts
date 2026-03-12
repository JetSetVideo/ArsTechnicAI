import { NextApiRequest, NextApiResponse } from 'next';

// Custom error classes for more specific error handling
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

// Centralized error handling middleware
export function errorHandler(
  error: Error, 
  req: NextApiRequest, 
  res: NextApiResponse
) {
  console.error('Unhandled Error:', error);

  // Detailed error response based on error type
  switch (error.name) {
    case 'ValidationError':
      return res.status(400).json({
        status: 'error',
        type: 'validation',
        message: error.message
      });

    case 'AuthorizationError':
      return res.status(403).json({
        status: 'error',
        type: 'authorization',
        message: error.message
      });

    case 'ResourceNotFoundError':
      return res.status(404).json({
        status: 'error',
        type: 'not_found',
        message: error.message
      });

    case 'PrismaClientKnownRequestError':
      // Handle database-specific errors
      const prismaError = error as any;
      switch (prismaError.code) {
        case 'P2002':
          return res.status(409).json({
            status: 'error',
            type: 'conflict',
            message: 'A unique constraint was violated'
          });
        case 'P2025':
          return res.status(404).json({
            status: 'error',
            type: 'not_found',
            message: 'Record not found'
          });
        default:
          return res.status(500).json({
            status: 'error',
            type: 'database',
            message: 'A database error occurred'
          });
      }

    default:
      // Generic server error for unhandled cases
      return res.status(500).json({
        status: 'error',
        type: 'server',
        message: 'An unexpected error occurred'
      });
  }
}

// Async error wrapper for route handlers
export function asyncHandler(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error as Error, req, res);
    }
  };
}
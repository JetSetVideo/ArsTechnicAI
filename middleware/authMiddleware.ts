import { NextApiRequest, NextApiResponse } from 'next';
import { AuthService } from '../services/auth/authService';

// Authentication middleware types
type NextApiHandlerWithAuth = (
  req: NextApiRequest, 
  res: NextApiResponse, 
  userId: string, 
  userRoles: string[]
) => Promise<void>;

export function withAuth(handler: NextApiHandlerWithAuth) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = AuthService.verifyToken(token);

      // Attach user information to request
      (req as any).userId = decoded.id;
      (req as any).userRoles = decoded.roles;

      // Call the original handler with additional user context
      return await handler(
        req, 
        res, 
        decoded.id, 
        decoded.roles
      );

    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ 
        message: error instanceof Error ? error.message : 'Unauthorized' 
      });
    }
  };
}

// Role-based authorization decorator
export function requireRoles(allowedRoles: string[]) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(
      req: NextApiRequest, 
      res: NextApiResponse, 
      userId: string, 
      userRoles: string[]
    ) {
      // Check if user has any of the required roles
      const hasRequiredRole = userRoles.some(role => 
        allowedRoles.includes(role)
      );

      if (!hasRequiredRole) {
        return res.status(403).json({ 
          message: 'Insufficient permissions' 
        });
      }

      // Call original method if authorized
      return originalMethod.apply(this, arguments);
    };

    return descriptor;
  };
}
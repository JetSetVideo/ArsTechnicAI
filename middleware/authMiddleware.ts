import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/auth/requestAuth';

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
      if (!req.headers.authorization) {
        return res.status(401).json({ message: 'No token provided' });
      }

      // Pinned algorithm/issuer/audience + banned/inactive accounts (lib/auth/requestAuth).
      const principal = await authenticate(req, res);
      if (!principal || principal.kind !== 'user' || principal.via !== 'jwt') {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      (req as any).userId = principal.userId;
      (req as any).userRoles = principal.roles;

      return await handler(req, res, principal.userId, principal.roles);

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
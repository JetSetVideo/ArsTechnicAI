import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { AppError, UnauthorizedError, ValidationError } from './errors';
import { errorResponse } from './response';
import type { ZodSchema } from 'zod';
import type { Role } from '@prisma/client';
import { hasRole } from '@/lib/auth/permissions';

export interface AuthenticatedRequest extends NextApiRequest {
  userId: string;
  userRole: Role;
  userEmail: string;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HandlerConfig {
  methods: HttpMethod[];
  auth?: boolean;
  role?: Role;
  bodySchema?: ZodSchema;
  querySchema?: ZodSchema;
}

type RouteHandler = (
  req: AuthenticatedRequest,
  res: NextApiResponse
) => Promise<void> | void;

export function createApiHandler(config: HandlerConfig, handler: RouteHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Method check
      if (!config.methods.includes(req.method as HttpMethod)) {
        res.setHeader('Allow', config.methods.join(', '));
        return errorResponse(res, 405, `Method ${req.method} not allowed`);
      }

      const authReq = req as AuthenticatedRequest;

      // Auth check
      if (config.auth !== false) {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.id) {
          throw new UnauthorizedError();
        }
        authReq.userId = session.user.id;
        authReq.userRole = session.user.role as Role;
        authReq.userEmail = session.user.email!;

        // Role check
        if (config.role && !hasRole(authReq.userRole, config.role)) {
          return errorResponse(res, 403, 'Insufficient permissions');
        }
      }

      // Body validation
      if (config.bodySchema && ['POST', 'PUT', 'PATCH'].includes(req.method!)) {
        const result = config.bodySchema.safeParse(req.body);
        if (!result.success) {
          const errors: Record<string, string[]> = {};
          for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            errors[path] = errors[path] || [];
            errors[path].push(issue.message);
          }
          throw new ValidationError('Validation failed', errors);
        }
        req.body = result.data;
      }

      // Query validation
      if (config.querySchema) {
        const result = config.querySchema.safeParse(req.query);
        if (!result.success) {
          const errors: Record<string, string[]> = {};
          for (const issue of result.error.issues) {
            const path = issue.path.join('.');
            errors[path] = errors[path] || [];
            errors[path].push(issue.message);
          }
          throw new ValidationError('Invalid query parameters', errors);
        }
      }

      await handler(authReq, res);
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(
          res,
          error.statusCode,
          error.message,
          error.code,
          error instanceof ValidationError ? error.errors : undefined
        );
      }

      console.error('Unhandled API error:', error);
      return errorResponse(res, 500, 'Internal server error', 'INTERNAL_ERROR');
    }
  };
}

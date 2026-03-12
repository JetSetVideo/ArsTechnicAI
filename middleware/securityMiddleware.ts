import { NextApiRequest, NextApiResponse } from 'next';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../utils/logger';

// Extended security middleware
export function securityMiddleware(
  req: NextApiRequest, 
  res: NextApiResponse,
  next: () => void
) {
  // Generate unique request ID for tracing
  const requestId = uuidv4();
  res.setHeader('X-Request-ID', requestId);

  // Log incoming requests
  Logger.http(`${req.method} ${req.url}`, {
    requestId,
    ip: req.socket.remoteAddress,
    userAgent: req.headers['user-agent']
  });

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'"
  ].join('; '));

  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Add request tracking
  (req as any).requestId = requestId;

  next();
}

// Rate limiting and brute force protection
export function bruteForceProtection(
  req: NextApiRequest, 
  res: NextApiResponse,
  next: () => void
) {
  const ip = req.socket.remoteAddress;
  const attempts = getLoginAttempts(ip);

  if (attempts > 5) {
    Logger.security('Brute force attempt detected', { ip });
    return res.status(429).json({
      message: 'Too many attempts. Please try again later.'
    });
  }

  next();
}

// Mock implementation - replace with Redis or dedicated store
function getLoginAttempts(ip: string | undefined): number {
  // This would be replaced with a proper tracking mechanism
  return 0;
}
/**
 * JWT signing / verification for the custom auth API (services/auth/authService).
 *
 * - The algorithm is pinned (HS256) on both sides, so a token cannot choose its
 *   own algorithm ("alg: none", RS/HS confusion).
 * - Tokens carry an issuer and audience and are rejected without them.
 * - The secret must be at least 32 characters and not a known placeholder.
 *   In production a bad secret is fatal; in development it is a loud warning so
 *   an offline laptop can still start with a throwaway .env.
 */
import * as jwt from 'jsonwebtoken';

export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_ISSUER = 'arstechnicai';
export const JWT_AUDIENCE = 'arstechnicai-app';
const MIN_SECRET_LENGTH = 32;

const PLACEHOLDER_SECRETS = new Set([
  'extremelylongrandomlygeneratedsecretkey',
  'your_jwt_secret',
  'changeme',
  'secret',
]);

export interface TokenClaims {
  id: string;
  email: string;
  roles: string[];
}

export function secretProblem(secret: string | undefined): string | null {
  if (!secret) return 'JWT_SECRET is not set';
  if (secret.length < MIN_SECRET_LENGTH) return `JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters`;
  if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) return 'JWT_SECRET is a known placeholder value';
  return null;
}

let warned = false;
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  const problem = secretProblem(secret);
  if (problem) {
    if (env.NODE_ENV === 'production') throw new Error(`${problem}. Generate one with: openssl rand -base64 48`);
    if (!warned) {
      warned = true;
      console.warn(`[auth] ${problem} — acceptable for local development only.`);
    }
  }
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signToken(claims: TokenClaims, expiresIn: string | number, secret = getJwtSecret()): string {
  return jwt.sign({ id: claims.id, email: claims.email, roles: claims.roles }, secret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string, secret = getJwtSecret()): TokenClaims {
  const decoded = jwt.verify(token, secret, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  if (typeof decoded !== 'object' || decoded === null) throw new Error('Malformed token');
  const { id, email, roles } = decoded as Record<string, unknown>;
  if (typeof id !== 'string' || typeof email !== 'string') throw new Error('Malformed token');
  return { id, email, roles: Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [] };
}

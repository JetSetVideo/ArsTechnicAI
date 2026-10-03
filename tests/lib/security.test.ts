/**
 * Security primitives — regression tests for the holes found in merge round 3:
 * - loopback trust (proxy / DNS rebinding / CSRF must never qualify)
 * - JWT pinning (alg, issuer, audience) and secret strength
 * - path containment for ids that become file names
 * - client IP for rate limiting (no spoofing through X-Forwarded-For)
 * - the fetch interceptor only decorates this app's own API calls
 */
import { describe, it, expect } from 'vitest';
import * as jwt from 'jsonwebtoken';
import path from 'path';
import { isTrustedLoopback, hasAtLeast, highestRole, loopbackTrustEnabled } from '../../lib/auth/requestAuth';
import { signToken, verifyToken, secretProblem, JWT_ISSUER, JWT_AUDIENCE } from '../../lib/auth/jwt';
import { isSafeId, resolveInside, UnsafePathError } from '../../lib/security/safePath';
import { clientIp } from '../../lib/security/clientIp';
import { shouldAttach } from '../../lib/auth/fetchAuth';

const SECRET = 'a'.repeat(16) + 'b'.repeat(16) + 'c'.repeat(16); // 48 chars, not a placeholder

// What Next 14 injects into every API request from a direct client (base-server.js `??=`).
const nextInjected = (host: string, remote: string) => ({
  host,
  'x-forwarded-host': host,
  'x-forwarded-port': host.split(':')[1] ?? '80',
  'x-forwarded-proto': 'http',
  'x-forwarded-for': remote,
});

describe('loopback trust', () => {
  const direct = { remoteAddress: '127.0.0.1', headers: nextInjected('127.0.0.1:3002', '127.0.0.1') };

  it('trusts a direct local client, with the headers Next adds itself', () => {
    expect(isTrustedLoopback(direct)).toBe(true);
    expect(isTrustedLoopback({ remoteAddress: '::1', headers: nextInjected('localhost:3002', '::1') })).toBe(true);
    expect(isTrustedLoopback({ remoteAddress: '127.0.0.1', headers: { host: 'localhost:3002' } })).toBe(true);
  });

  it('trusts the same-origin browser tab of the app itself', () => {
    expect(isTrustedLoopback({ ...direct, headers: { ...direct.headers, origin: 'http://127.0.0.1:3002', 'sec-fetch-site': 'same-origin' } })).toBe(true);
  });

  it.each([
    ['a non-loopback socket', { remoteAddress: '192.168.1.20' }],
    ['nginx (X-Real-IP)', { headers: { ...direct.headers, 'x-real-ip': '127.0.0.1' } }],
    ['a proxy with a client XFF', { headers: { ...direct.headers, 'x-forwarded-for': '203.0.113.9' } }],
    ['a proxy chain XFF', { headers: { ...direct.headers, 'x-forwarded-for': '203.0.113.9, 127.0.0.1' } }],
    ['RFC 7239 Forwarded', { headers: { ...direct.headers, forwarded: 'for=203.0.113.9' } }],
    ['a rewritten X-Forwarded-Host', { headers: { ...direct.headers, 'x-forwarded-host': 'arstechnicai.freeboxos.fr' } }],
    ['DNS rebinding (foreign Host)', { headers: { ...nextInjected('evil.example:3002', '127.0.0.1') } }],
    ['a missing Host', { headers: { 'x-forwarded-for': '127.0.0.1' } }],
    ['a cross-site page (Sec-Fetch-Site)', { headers: { ...direct.headers, 'sec-fetch-site': 'cross-site' } }],
    ['a same-site but other-port page', { headers: { ...direct.headers, 'sec-fetch-site': 'same-site' } }],
    ['a foreign Origin', { headers: { ...direct.headers, origin: 'https://evil.example' } }],
    ['another local port as Origin', { headers: { ...direct.headers, origin: 'http://127.0.0.1:8080' } }],
    ['an opaque Origin', { headers: { ...direct.headers, origin: 'null' } }],
  ])('refuses %s', (_label, override) => {
    expect(isTrustedLoopback({ ...direct, ...override } as never)).toBe(false);
  });

  it('is on by default in development and off in production unless forced', () => {
    expect(loopbackTrustEnabled({ NODE_ENV: 'development' } as never)).toBe(true);
    expect(loopbackTrustEnabled({ NODE_ENV: 'production' } as never)).toBe(false);
    expect(loopbackTrustEnabled({ NODE_ENV: 'production', ARS_TRUST_LOOPBACK: '1' } as never)).toBe(true);
    expect(loopbackTrustEnabled({ NODE_ENV: 'development', ARS_TRUST_LOOPBACK: '0' } as never)).toBe(false);
  });
});

describe('roles', () => {
  it('ranks roles and checks minimums', () => {
    expect(highestRole(['USER', 'ADMIN'])).toBe('ADMIN');
    expect(highestRole([])).toBe('USER');
    expect(hasAtLeast(['SUPERADMIN'], 'ADMIN')).toBe(true);
    expect(hasAtLeast(['USER'], 'ADMIN')).toBe(false);
    expect(hasAtLeast(['CREATOR'], 'USER')).toBe(true);
  });
});

describe('JWT', () => {
  const claims = { id: 'u1', email: 'u1@example.test', roles: ['USER'] };

  it('round-trips signed claims', () => {
    expect(verifyToken(signToken(claims, '1h', SECRET), SECRET)).toEqual(claims);
  });

  it('rejects a token signed with another secret', () => {
    expect(() => verifyToken(signToken(claims, '1h', SECRET.replace('a', 'z')), SECRET)).toThrow();
  });

  it('rejects tokens without the pinned issuer/audience (pre-hardening tokens)', () => {
    const legacy = jwt.sign(claims, SECRET, { expiresIn: '1h' });
    expect(() => verifyToken(legacy, SECRET)).toThrow();
    const wrongAud = jwt.sign(claims, SECRET, { expiresIn: '1h', issuer: JWT_ISSUER, audience: 'someone-else' });
    expect(() => verifyToken(wrongAud, SECRET)).toThrow();
  });

  it('rejects alg=none and other algorithms', () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, roles: ['SUPERADMIN'], iss: JWT_ISSUER, aud: JWT_AUDIENCE })}.`;
    expect(() => verifyToken(none, SECRET)).toThrow();
    const hs512 = jwt.sign(claims, SECRET, { algorithm: 'HS512', issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    expect(() => verifyToken(hs512, SECRET)).toThrow();
  });

  it('rejects expired tokens', () => {
    const expired = jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    expect(() => verifyToken(expired, SECRET)).toThrow();
  });

  it('judges secret strength', () => {
    expect(secretProblem(undefined)).toMatch(/not set/);
    expect(secretProblem('short')).toMatch(/shorter/);
    expect(secretProblem('extremelylongrandomlygeneratedsecretkey')).toMatch(/placeholder/);
    expect(secretProblem(SECRET)).toBeNull();
  });
});

describe('safe paths', () => {
  it.each(['c32030f8-c073-4223-b027-2d7e9352a9f0', 'smoke-test', 'cmurh1sxw0000de7bso2ikyzq', 'a_b'])('accepts id %s', (id) => {
    expect(isSafeId(id)).toBe(true);
  });

  it.each(['', '..', '../x', 'x/../../tmp', 'a/b', 'a\\b', '.hidden', 'a.json', 'x'.repeat(129), 'é', 'a b', 'a\0b'])(
    'rejects id %j',
    (id) => expect(isSafeId(id)).toBe(false)
  );

  it('rejects non-strings', () => {
    expect(isSafeId(undefined)).toBe(false);
    expect(isSafeId(['a'])).toBe(false);
    expect(isSafeId(42)).toBe(false);
  });

  it('contains resolved paths in their base', () => {
    const base = path.resolve('/srv/data');
    expect(resolveInside(base, 'canvas-abc.json')).toBe(path.join(base, 'canvas-abc.json'));
    expect(() => resolveInside(base, 'canvas-x/../../../../tmp/pwn.json')).toThrow(UnsafePathError);
    expect(() => resolveInside(base, '/etc/passwd')).toThrow(UnsafePathError);
    expect(() => resolveInside(base, '..', 'data-sibling')).toThrow(UnsafePathError);
  });
});

describe('client IP', () => {
  const req = (remoteAddress: string, headers: Record<string, string> = {}) => ({ socket: { remoteAddress }, headers }) as never;

  it('uses the socket for direct clients and ignores their headers', () => {
    expect(clientIp(req('198.51.100.7', { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }))).toBe('198.51.100.7');
  });

  it('behind local nginx, prefers X-Real-IP', () => {
    expect(clientIp(req('127.0.0.1', { 'x-real-ip': '198.51.100.7', 'x-forwarded-for': 'spoofed, 198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('falls back to the LAST X-Forwarded-For entry (the first is client-controlled)', () => {
    expect(clientIp(req('127.0.0.1', { 'x-forwarded-for': '6.6.6.6, 198.51.100.7' }))).toBe('198.51.100.7');
  });
});

describe('fetch interceptor scope', () => {
  const base = 'http://localhost:3002/home';
  const origins = ['http://localhost:3002', 'http://192.168.1.55:3002'];

  it('decorates own-API calls, relative or absolute', () => {
    expect(shouldAttach('/api/workspace/save', base, origins)).toBe(true);
    expect(shouldAttach('http://192.168.1.55:3002/api/sync/manifest', base, origins)).toBe(true);
  });

  it('never decorates third parties or non-API paths', () => {
    expect(shouldAttach('https://generativelanguage.googleapis.com/v1/models', base, origins)).toBe(false);
    expect(shouldAttach('https://evil.example/api/steal', base, origins)).toBe(false);
    expect(shouldAttach('/generated/image.png', base, origins)).toBe(false);
    expect(shouldAttach('http://localhost:3002.evil.example/api/x', base, origins)).toBe(false);
  });
});

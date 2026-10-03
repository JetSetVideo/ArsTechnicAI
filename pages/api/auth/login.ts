import type { NextApiRequest, NextApiResponse } from 'next';
import AuthService from '../../../services/auth/authService';
import rateLimit from '../../../utils/rateLimit';
import { clientIp } from '@/lib/security/clientIp';

// Per IP and per account. The key used to be the constant 'LOGIN_TOKEN' — one
// global bucket, so ten failed logins from anyone locked everyone out.
const ipLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 5000 });
const accountLimiter = rateLimit({ interval: 15 * 60 * 1000, uniqueTokenPerInterval: 5000 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // 10 attempts per minute per IP
    await ipLimiter.check(req, res, 10, `ip:${clientIp(req)}`);

    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // 20 attempts per 15 minutes per account, whatever the source IP
    await accountLimiter.check(req, res, 20, `acct:${email.toLowerCase().trim()}`);

    const authResult = await AuthService.login(email, password);

    return res.status(200).json({
      message: 'Login successful',
      user: authResult.user,
      token: authResult.token,
      expiresIn: authResult.expiresIn,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error) {
      if (error.message === 'Rate limit exceeded') {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ message: 'Too many attempts. Try again in a minute.' });
      }
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Login failed' });
  }
}

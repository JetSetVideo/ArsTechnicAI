import type { NextApiRequest, NextApiResponse } from 'next';
import AuthService from '../../../services/auth/authService';
import rateLimit from '../../../utils/rateLimit';

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 10 login attempts per minute per IP
    await limiter.check(req, res, 10, 'LOGIN_TOKEN');

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

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
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Login failed' });
  }
}

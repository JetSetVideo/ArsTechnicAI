import type { NextApiRequest, NextApiResponse } from 'next';
import AuthService from '../../../services/auth/authService';
import rateLimit from '../../../utils/rateLimit';

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 500,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Stricter rate limit for registration (5 per minute)
    await limiter.check(req, res, 5, 'REGISTER_TOKEN');

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { firstName, lastName, email, pseudonym, password } = req.body;

    if (!firstName || !lastName || !email || !pseudonym || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const authResult = await AuthService.register({ firstName, lastName, email, pseudonym, password });

    return res.status(201).json({
      message: 'Account created successfully',
      user: authResult.user,
      token: authResult.token,
      expiresIn: authResult.expiresIn,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message });
      }
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Registration failed' });
  }
}

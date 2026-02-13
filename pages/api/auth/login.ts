import type { NextApiRequest, NextApiResponse } from 'next';
import AuthService from '../../../services/auth/authService';
import rateLimit from '../../../utils/rateLimit';

// Rate limiting configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500 // Max 500 users per interval
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Apply rate limiting
    await limiter.check(req, res, 10, 'CACHE_TOKEN');

    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Authenticate user
    const authResult = await AuthService.login(email, password);

    return res.status(200).json({
      message: 'Login successful',
      user: authResult.user,
      token: authResult.token
    });

  } catch (error) {
    console.error('Login error:', error);
    
    // Differentiate between various error types
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      return res.status(400).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: 'Login failed due to an unexpected error' 
    });
  }
}
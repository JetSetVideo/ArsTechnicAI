import type { NextApiRequest, NextApiResponse } from 'next';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/google/callback`;

  if (!clientId || clientId === 'your_google_client_id') {
    return res.status(503).json({ message: 'Google OAuth is not configured' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  return res.status(200).json(url);
}

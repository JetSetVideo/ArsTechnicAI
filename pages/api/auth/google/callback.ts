import type { NextApiRequest, NextApiResponse } from 'next';
import AuthService from '../../../../services/auth/authService';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`${appUrl}/home?auth_error=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${appUrl}/home?auth_error=missing_code`);
    }

    // Exchange authorization code for tokens using native fetch
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenRes.json() as { access_token: string };

    // Fetch user profile from Google
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const data = await userRes.json() as {
      id: string;
      email: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    };

    if (!data.id || !data.email) {
      return res.redirect(`${appUrl}/home?auth_error=incomplete_profile`);
    }

    const authResult = await AuthService.googleAuth({
      googleId: data.id,
      email: data.email,
      firstName: data.given_name || data.name?.split(' ')[0] || '',
      lastName: data.family_name || data.name?.split(' ').slice(1).join(' ') || '',
      profileImage: data.picture,
    });

    const redirectUrl = new URL(`${appUrl}/home`);
    redirectUrl.searchParams.set('auth_token', authResult.token);
    redirectUrl.searchParams.set('auth_expires_in', String(authResult.expiresIn));

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return res.redirect(`${appUrl}/home?auth_error=${encodeURIComponent(message)}`);
  }
}

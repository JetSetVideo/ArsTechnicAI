import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import UserService from '../../../../services/user/userService';

// Configure OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'Invalid or missing authorization code' });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user information
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();

    // Create or update user in our system
    const userProfile = await UserService.registerOrUpdateGoogleUser({
      googleId: data.id!,
      email: data.email!,
      username: data.name || data.email!.split('@')[0],
      profileImage: data.picture
    });

    // Redirect to frontend with user token
    const frontendRedirectUrl = new URL(`${process.env.NEXTAUTH_URL}/dashboard`);
    frontendRedirectUrl.searchParams.append('token', userProfile.id);

    return res.redirect(frontendRedirectUrl.toString());

  } catch (error) {
    console.error('Google OAuth Callback Error:', error);
    return res.status(500).json({ message: 'Authentication failed' });
  }
}
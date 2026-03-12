import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from './password';
import { upsertDeviceFromHeaders } from './device';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user?.hashedPassword || !user.isActive) return null;

        const isValid = await verifyPassword(credentials.password, user.hashedPassword);
        if (!isValid) return null;

        // Track login stats and device
        const ip =
          (Array.isArray(req.headers?.['x-forwarded-for'])
            ? req.headers['x-forwarded-for'][0]
            : req.headers?.['x-forwarded-for']) ?? '127.0.0.1';

        let deviceId: string | undefined;
        let sessionId: string | undefined;

        try {
          const result = await upsertDeviceFromHeaders(user.id, req.headers ?? {});
          deviceId = result.deviceId;
          sessionId = result.sessionId;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              totalLogins: { increment: 1 },
              lastLoginAt: new Date(),
              lastLoginIp: typeof ip === 'string' ? ip : ip[0],
            },
          });
        } catch {
          // Device/stat tracking failures must not block login
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.name,
          role: user.role,
          image: user.avatarUrl || user.image,
          deviceId,
          sessionId,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'USER';
        const u = user as { deviceId?: string; sessionId?: string };
        if (u.deviceId) token.deviceId = u.deviceId;
        if (u.sessionId) token.sessionId = u.sessionId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      // NextAuth 4 JWT signOut provides token in message
      const token = (message as { token?: Record<string, unknown> }).token;
      if (!token?.sessionId) return;

      try {
        const userSession = await prisma.userSession.findUnique({
          where: { id: token.sessionId as string },
        });

        if (userSession && !userSession.endedAt) {
          const endedAt = new Date();
          const durationMs = endedAt.getTime() - userSession.startedAt.getTime();

          await prisma.userSession.update({
            where: { id: userSession.id },
            data: { endedAt, durationMs },
          });

          if (token.sub) {
            await prisma.user.update({
              where: { id: token.sub as string },
              data: {
                totalMinutesOnline: { increment: Math.floor(durationMs / 60000) },
              },
            });
          }
        }
      } catch {
        // Ignore errors in signOut event
      }
    },
  },
};

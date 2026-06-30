import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { verifyPassword } from './password';

// DB is optional — app runs fully offline without it
const hasDatabase = !!process.env.DATABASE_URL;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let makePrismaAdapter: ((p: any) => any) | null = null;

if (hasDatabase) {
  try {
    prisma = require('@/lib/prisma').prisma;
    makePrismaAdapter = require('@next-auth/prisma-adapter').PrismaAdapter;
  } catch {
    // Prisma not available — continue without DB
  }
}

export const authOptions: NextAuthOptions = {
  ...(hasDatabase && prisma && makePrismaAdapter ? { adapter: makePrismaAdapter(prisma) } : {}),
  secret: process.env.NEXTAUTH_SECRET,
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
        if (!hasDatabase || !prisma) return null; // offline mode: no credential auth

        try {
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
            const { upsertDeviceFromHeaders } = require('./device');
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
        } catch {
          return null; // DB unavailable — fail gracefully
        }
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
      if (!hasDatabase || !prisma) return;
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

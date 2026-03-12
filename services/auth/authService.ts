import { PrismaClient, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
type UserWithRoles = User & { roles: UserRole[] };

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  pseudonym: string | null;
  profileImage: string | null;
}

interface AuthResult {
  user: SafeUser;
  token: string;
  expiresIn: number; // ms
}

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  pseudonym: string;
  password: string;
}

interface GoogleAuthInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

// Derive a safe user object (never exposes password hash or internal fields)
function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    pseudonym: user.pseudonym ?? null,
    profileImage: user.profileImage ?? null,
  };
}

// Parse JWT_EXPIRATION env var ("7d", "24h", "3600") into milliseconds
function parseExpiryMs(): number {
  const raw = process.env.JWT_EXPIRATION || '7d';
  const match = raw.match(/^(\d+)([smhd]?)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default:  return val * 1000;
  }
}

// Generate a unique pseudonym if the desired one is taken (suffix with numbers)
async function ensureUniquePseudonym(desired: string): Promise<string> {
  const base = desired.trim();
  const exists = await prisma.user.findUnique({ where: { pseudonym: base } });
  if (!exists) return base;
  // Try up to 10 numeric suffixes
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}${i}`;
    const taken = await prisma.user.findUnique({ where: { pseudonym: candidate } });
    if (!taken) return candidate;
  }
  throw new Error('Could not generate a unique pseudonym — please choose a different one');
}

export class AuthService {
  // ─── Register ───────────────────────────────────────────────────────────────
  static async register(input: RegisterInput): Promise<AuthResult> {
    if (!input.firstName || !input.lastName || !input.email || !input.pseudonym || !input.password) {
      throw new Error('All fields are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw new Error('Invalid email address');
    }

    // Password strength: minimum 8 characters
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check for duplicate email
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) {
      throw new Error('An account with this email already exists');
    }

    // Ensure unique pseudonym (auto-suffix if needed)
    const pseudonym = await ensureUniquePseudonym(input.pseudonym);

    // Hash password with cost factor 12
    const passwordHash = await bcrypt.hash(input.password, 12);

    // Derive a safe internal username from pseudonym (used as DB @unique field)
    const username = pseudonym.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const user = await prisma.user.create({
      data: {
        username,
        email: input.email.toLowerCase().trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        pseudonym,
        passwordHash,
        roles: {
          connectOrCreate: {
            where: { name: 'USER' },
            create: { name: 'USER' },
          },
        },
      },
      include: { roles: true },
    });

    // Update lastLogin
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = this.generateJWT(user);
    return { user: toSafeUser(user), token, expiresIn: parseExpiryMs() };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  static async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roles: true },
    });

    // Use constant-time comparison to prevent user enumeration
    if (!user || !user.passwordHash) {
      await bcrypt.hash('dummy_prevent_timing_attack', 12);
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive || user.isBanned) {
      throw new Error('Account is not active');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = this.generateJWT(user);
    return { user: toSafeUser(user), token, expiresIn: parseExpiryMs() };
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────
  static async googleAuth(input: GoogleAuthInput): Promise<AuthResult> {
    let user = await prisma.user.findUnique({
      where: { googleId: input.googleId },
      include: { roles: true },
    });

    if (!user) {
      // Also check if this email already exists (link accounts)
      const byEmail = await prisma.user.findUnique({ where: { email: input.email } });
      if (byEmail) {
        // Link Google ID to existing account
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: input.googleId, profileImage: input.profileImage },
          include: { roles: true },
        });
      } else {
        // New user via Google
        const desiredPseudonym = `${input.firstName}${input.lastName}`.replace(/\s+/g, '');
        const pseudonym = await ensureUniquePseudonym(desiredPseudonym || input.email.split('@')[0]);
        const username = pseudonym.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        user = await prisma.user.create({
          data: {
            username,
            email: input.email.toLowerCase().trim(),
            firstName: input.firstName,
            lastName: input.lastName,
            pseudonym,
            googleId: input.googleId,
            profileImage: input.profileImage,
            roles: {
              connectOrCreate: {
                where: { name: 'USER' },
                create: { name: 'USER' },
              },
            },
          },
          include: { roles: true },
        });
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = this.generateJWT(user);
    return { user: toSafeUser(user), token, expiresIn: parseExpiryMs() };
  }

  // ─── JWT ─────────────────────────────────────────────────────────────────────
  private static generateJWT(user: UserWithRoles): string {
    const roles = (user.roles || []).map((r) => r.name);
    return jwt.sign(
      { id: user.id, email: user.email, roles },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRATION || '7d') as any }
    );
  }

  static verifyToken(token: string): { id: string; email: string; roles: string[] } {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }
}

export default AuthService;

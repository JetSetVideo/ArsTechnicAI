import { PrismaClient, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
type UserWithRoles = User & { roles: UserRole[] };

interface AuthResult {
  user: Partial<User>;
  token: string;
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

interface GoogleAuthInput {
  googleId: string;
  email: string;
  username: string;
  profileImage?: string;
}

export class AuthService {
  // Register new user
  static async register(input: RegisterInput): Promise<AuthResult> {
    // Input validation
    if (!input.username || !input.email || !input.password) {
      throw new Error('Incomplete registration details');
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          { username: input.username }
        ]
      }
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        roles: {
          connectOrCreate: {
            where: { name: 'USER' },
            create: { name: 'USER' }
          }
        }
      },
      include: {
        roles: true,
      },
    });

    // Generate JWT
    const token = this.generateJWT(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    };
  }

  // Google OAuth Authentication
  static async googleAuth(input: GoogleAuthInput): Promise<AuthResult> {
    let user = await prisma.user.findUnique({
      where: { googleId: input.googleId },
      include: {
        roles: true,
      },
    });

    if (!user) {
      // Create new user if not exists
      user = await prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          googleId: input.googleId,
          profileImage: input.profileImage,
          roles: {
            connectOrCreate: {
              where: { name: 'USER' },
              create: { name: 'USER' }
            }
          }
        },
        include: {
          roles: true,
        },
      });
    }

    // Generate JWT
    const token = this.generateJWT(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage
      },
      token
    };
  }

  // Login with email and password
  static async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT
    const token = this.generateJWT(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    };
  }

  // JWT Generation
  private static generateJWT(user: UserWithRoles): string {
    const roles = (user.roles || []).map((role) => role.name);
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        roles
      },
      process.env.JWT_SECRET!,
      { 
        expiresIn: process.env.JWT_EXPIRATION || '7d' 
      }
    );
  }

  // Token Verification
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}

export default AuthService;
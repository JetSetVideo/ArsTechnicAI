import CryptoAuthService from '../auth/cryptoAuth';
import { v4 as uuidv4 } from 'uuid';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  publicKey: string;
  createdAt: Date;
  lastLogin: Date;
  roles: string[];
  googleId?: string;
  profileImage?: string;
}

interface UserRegistrationRequest {
  username: string;
  email: string;
  password: string;
}

class UserService {
  // In-memory storage (replace with database in production)
  private static users: Map<string, UserProfile> = new Map();
  private static googleUsers: Map<string, string> = new Map(); // GoogleID to UserID mapping

  // Google user registration/update
  static async registerOrUpdateGoogleUser(googleUserData: {
    googleId: string;
    email: string;
    username: string;
    profileImage?: string;
  }): Promise<UserProfile> {
    // Check if Google user already exists
    const existingUserId = this.googleUsers.get(googleUserData.googleId);
    
    if (existingUserId) {
      const existingUser = this.users.get(existingUserId);
      if (existingUser) {
        // Update last login
        existingUser.lastLogin = new Date();
        return existingUser;
      }
    }

    // Create new user profile
    const userProfile: UserProfile = {
      id: uuidv4(),
      username: googleUserData.username,
      email: googleUserData.email,
      publicKey: '', // Placeholder - generate if needed
      createdAt: new Date(),
      lastLogin: new Date(),
      roles: ['user'],
      googleId: googleUserData.googleId,
      profileImage: googleUserData.profileImage
    };

    // Store user and Google mapping
    this.users.set(userProfile.id, userProfile);
    this.googleUsers.set(googleUserData.googleId, userProfile.id);

    return userProfile;
  }

  // User registration with advanced security
  static async registerUser(request: UserRegistrationRequest): Promise<UserProfile> {
    // Validate input
    if (!request.username || !request.email || !request.password) {
      throw new Error('Incomplete registration details');
    }

    // Check for existing username/email
    const existingUser = Array.from(this.users.values()).find(
      user => user.username === request.username || user.email === request.email
    );
    
    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Generate cryptographic key pair
    const { privateKey, publicKey } = CryptoAuthService.generateKeyPair();

    // Create user profile
    const userProfile: UserProfile = {
      id: uuidv4(),
      username: request.username,
      email: request.email,
      publicKey: publicKey,
      createdAt: new Date(),
      lastLogin: new Date(),
      roles: ['user']  // Default role
    };

    // Store user (mock storage - replace with secure database)
    this.users.set(userProfile.id, userProfile);

    return userProfile;
  }

  // Advanced authentication method
  static async authenticateUser(email: string, password: string) {
    // Find user by email
    const user = Array.from(this.users.values()).find(u => u.email === email);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Generate multi-factor challenge
    const challenge = await CryptoAuthService.generateMFAChallenge({
      publicKey: user.publicKey,
      encryptedPrivateKey: '', // Placeholder
      salt: ''  // Placeholder
    });

    // Risk assessment
    const riskScore = CryptoAuthService.assessAuthenticationRisk({
      device: 'known',
      location: 'expected',
      behavior: 'typical'
    });

    // Adaptive authentication
    if (riskScore > 20) {
      // Trigger additional verification
      throw new Error('High-risk login attempt');
    }

    // Update last login
    user.lastLogin = new Date();

    return {
      user,
      challenge,
      riskScore
    };
  }

  // Get user profile (with role-based access)
  static getUserProfile(userId: string, requestorRoles: string[]): UserProfile {
    const user = this.users.get(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Basic role-based access control
    const allowedRoles = ['admin', 'user'];
    const hasAccess = requestorRoles.some(role => allowedRoles.includes(role));

    if (!hasAccess) {
      throw new Error('Insufficient permissions');
    }

    return user;
  }
}

export default UserService;
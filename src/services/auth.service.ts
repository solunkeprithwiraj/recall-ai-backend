import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../utils/prisma";

const JWT_SECRET: string =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  age?: number;
  educationLevel?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
}

class AuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare a plain text password with a hashed password
   */
  async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generate a JWT token for a user
   */
  generateToken(userId: string, email: string): string {
    const payload: AuthTokenPayload = { userId, email };
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, JWT_SECRET, options);
  }

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData) {
    const { email, password, name, age, educationLevel } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        age: age || null,
        educationLevel: educationLevel || "high_school",
      },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        educationLevel: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      user,
      token,
    };
  }

  /**
   * Login a user
   */
  async login(data: LoginData) {
    const { email, password } = data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate token
    const token = this.generateToken(user.id, user.email);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        educationLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}

export default new AuthService();

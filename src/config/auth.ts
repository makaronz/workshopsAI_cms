import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db } from "./database";
import { users, facilitators } from "../models/schema";
import { eq } from "drizzle-orm";

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "your-refresh-secret-key";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

// Password configuration
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "12");

// User roles
export type UserRole = "participant" | "facilitator" | "moderator" | "sociologist-editor" | "admin";

// Role permissions
export const ROLE_PERMISSIONS = {
  participant: ["read:own-profile", "read:workshops", "create:enrollment", "read:own-enrollments", "create:feedback"],
  facilitator: ["read:own-profile", "read:workshops", "read:own-workshops", "update:own-workshops", "read:enrollments", "read:feedback"],
  moderator: ["read:all-profiles", "read:workshops", "create:workshops", "update:workshops", "read:enrollments", "update:enrollments", "manage:feedback"],
  "sociologist-editor": ["read:all-profiles", "create:workshops", "read:workshops", "update:workshops", "delete:workshops", "read:enrollments", "manage:facilitators", "read:facilitators", "read:feedback"],
  admin: ["*"], // All permissions
} as const;

// JWT Token interface
export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Authentication services
export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate access token
  static generateAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Generate refresh token
  static generateRefreshToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  }

  // Verify access token
  static verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
  }

  // Find user by email
  static async findUserByEmail(email: string) {
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user[0] || null;
  }

  // Find user by ID
  static async findUserById(id: number) {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user[0] || null;
  }

  // Find facilitator profile by user ID
  static async findFacilitatorByUserId(userId: number) {
    const facilitator = await db.select().from(facilitators).where(eq(facilitators.userId, userId)).limit(1);
    return facilitator[0] || null;
  }

  // Create user
  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) {
    const hashedPassword = await this.hashPassword(userData.password);

    const [user] = await db.insert(users).values({
      ...userData,
      password: hashedPassword,
      loginMethod: "local",
      isActive: true,
      emailVerified: false,
    }).returning();

    return user;
  }

  // Validate credentials
  static async validateCredentials(email: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password);

    if (!isValid) {
      return null;
    }

    return user;
  }

  // Update last login
  static async updateLastLogin(userId: number) {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Check if user has permission
  static hasPermission(userRole: UserRole, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    return permissions.includes("*") || permissions.includes(permission as any);
  }

  // Check if user can access resource
  static canAccessResource(userRole: UserRole, action: string, resource: string): boolean {
    const permission = `${action}:${resource}`;
    return this.hasPermission(userRole, permission);
  }
}

// Middleware: Authentication
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = AuthService.verifyAccessToken(token);

      // Find user to ensure they still exist and are active
      const user = await AuthService.findUserById(payload.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({
          error: "Invalid token",
          message: "User not found or inactive"
        });
      }

      // Attach user to request
      req.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({
        error: "Invalid token",
        message: "Token verification failed"
      });
    }
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      error: "Authentication error",
      message: "Internal server error"
    });
  }
};

// Middleware: Authorization
export const authorize = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated"
      });
    }

    if (!AuthService.hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: "Access denied",
        message: "Insufficient permissions"
      });
    }

    next();
  };
};

// Middleware: Role-based access
export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
        message: "Insufficient role permissions"
      });
    }

    next();
  };
};

// Middleware: Resource owner or admin
export const requireOwnerOrAdmin = (getResourceOwnerId: (req: Request) => Promise<number | null>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User not authenticated"
      });
    }

    // Admins can access everything
    if (req.user.role === "admin") {
      return next();
    }

    // Check if user owns the resource
    const resourceOwnerId = await getResourceOwnerId(req);

    if (resourceOwnerId === req.user.id) {
      return next();
    }

    return res.status(403).json({
      error: "Access denied",
      message: "You can only access your own resources"
    });
  };
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: UserRole;
      };
    }
  }
}
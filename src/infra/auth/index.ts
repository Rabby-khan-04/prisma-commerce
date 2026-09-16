import type { Request } from "express";

export type UserRole = "CUSTOMER" | "VENDOR" | "ADMIN";

export interface JwtPayload {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

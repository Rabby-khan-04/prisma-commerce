import {
  JsonWebTokenError,
  sign,
  TokenExpiredError,
  verify,
  type SignOptions,
} from "jsonwebtoken";

import { AuthenticationError, AuthorizationError } from "../errors/app-error";
import type { JwtPayload } from "./types";

export const verifyToken = (token: string, secret: string): JwtPayload => {
  try {
    return verify(token, secret) as JwtPayload;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AuthenticationError("Token is expired");
    }
    if (error instanceof JsonWebTokenError) {
      throw new AuthorizationError("Invalid token");
    }
    throw new AuthenticationError("Token validation failed");
  }
};

export const generateToken = (
  payload: Omit<JwtPayload, "exp" | "iat">,
  secret: string,
  expiresIn: string | number = "24h",
): string => {
  return sign(payload, secret, { expiresIn } as SignOptions);
};

export const generateRefreshToken = (
  payload: Omit<JwtPayload, "exp" | "iat">,
  secret: string,
  expiresIn: string | number = "7d",
): string => sign(payload, secret, { expiresIn } as SignOptions);

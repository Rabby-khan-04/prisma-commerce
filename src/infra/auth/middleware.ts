import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { AuthenticationError } from "../errors/app-error";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { verifyToken } from "./tokens";
import type { AuthenticatedRequest } from "./types";

function extractAccessToken(req: Request): string | undefined {
  const cookies = req.cookies as
    | Record<string, string | undefined>
    | undefined;

  const cookieToken = cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();

  return undefined;
}

/** Require a valid access token; attaches the payload to `req.user`. */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractAccessToken(req);

    if (!token) {
      throw new AuthenticationError("Authentication required");
    }

    (req as AuthenticatedRequest).user = verifyToken(
      token,
      env.JWT_ACCESS_SECRET,
    );

    return next();
  } catch (error) {
    return next(error);
  }
};

/** Attach the user when a valid access token is present, but never reject. */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = extractAccessToken(req);

    if (token) {
      (req as AuthenticatedRequest).user = verifyToken(
        token,
        env.JWT_ACCESS_SECRET,
      );
    }
  } catch {
    // Optional auth: an invalid token simply leaves the request anonymous.
  }

  return next();
};

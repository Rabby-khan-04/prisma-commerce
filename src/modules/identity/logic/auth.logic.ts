import bcrypt from "bcryptjs";
import { env } from "../../../config/env";
import type { JwtPayload } from "../../../infra/auth";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../../../infra/auth/cookies";
import {
  generateRefreshToken,
  generateToken,
  verifyToken,
} from "../../../infra/auth/tokens";
import type { ActionResult, RequestContext } from "../../../infra/controllers";
import {
  AuthenticationError,
  ConflictError,
} from "../../../infra/errors/app-error";
import { expiresAtFromDuration } from "../../../infra/utils/duration";
import type { UserLoginBody, UserRegisterBody } from "../schemas/auth.schema";
import { userService } from "../services/user.service";

const SALT_ROUND = 12;

// A valid bcrypt hash used only to keep the "unknown user" login path as slow
// as the "wrong password" path, so response timing does not leak account existence.
const DUMMY_PASSWORD_HASH =
  "$2b$12$qXIgK57QhloZNpkufoeXh.xpebzpYdnvUCgi47m5/6Mw6dW76FGnu";

export function generateTokens(payload: JwtPayload): {
  refreshToken: string;
  accessToken: string;
} {
  const accessToken = generateToken(
    payload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRE_AT,
  );
  const refreshToken = generateRefreshToken(
    payload,
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRE_AT,
  );

  return { accessToken, refreshToken };
}

export async function userRegister(
  ctx: RequestContext<UserRegisterBody>,
): Promise<ActionResult> {
  const body = ctx.body;

  const exist = await userService.findUserByEmail(body.email);
  if (exist) {
    throw new ConflictError("Email already exists");
  }

  const existUserName = await userService.findUserByUserName(body.username);
  if (existUserName) {
    throw new ConflictError(`Username ${body.username} already exists`);
  }

  const hashPassword = await bcrypt.hash(body.password, SALT_ROUND);

  const user = await userService.userCreate({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone ?? "",
    email: body.email,
    password: hashPassword,
    gender: body.gender,
    role: "CUSTOMER",
    username: body.username,
  });

  const tokens = generateTokens(buildTokenPayload(user));

  await userService.updateRefreshToken(
    user.id,
    tokens.refreshToken,
    getRefreshTokenExpire(),
  );

  return {
    data: { user: sanitizedUser(user) },
    message: "User created successfully",
    status: 201,
    cookies: setAuthCookies(tokens),
  };
}

export async function userLogin(
  ctx: RequestContext<UserLoginBody>,
): Promise<ActionResult> {
  const { identifier, password } = ctx.body;
  const user = await userService.findByIdentifier(identifier);

  // Always compare, even when the user is missing, so both failure paths take
  // comparable time and return an identical error.
  const isValidPassword = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !isValidPassword) {
    throw new AuthenticationError("Invalid email/username or password");
  }

  const tokens = generateTokens(buildTokenPayload(user));

  await userService.updateRefreshToken(
    user.id,
    tokens.refreshToken,
    getRefreshTokenExpire(),
  );

  return {
    data: { user: sanitizedUser(user) },
    message: "User logged in successfully",
    cookies: setAuthCookies(tokens),
  };
}

export async function refreshAccessToken(
  ctx: RequestContext,
): Promise<ActionResult> {
  const refreshToken = ctx.cookies[REFRESH_TOKEN_COOKIE];
  if (!refreshToken) {
    throw new AuthenticationError("Refresh token missing");
  }

  const decoded = verifyToken(refreshToken, env.JWT_REFRESH_SECRET);
  const user = await userService.findUserById(decoded.id);

  if (!user || !user.isActive) {
    throw new AuthenticationError("Invalid refresh token");
  }

  if (user.refreshToken !== refreshToken) {
    throw new AuthenticationError("Invalid refresh token");
  }

  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    await userService.updateRefreshToken(user.id, null, null);
    throw new AuthenticationError("Refresh token expired");
  }

  const tokens = generateTokens(buildTokenPayload(user));

  // Rotate the refresh token and persist the new one.
  await userService.updateRefreshToken(
    user.id,
    tokens.refreshToken,
    getRefreshTokenExpire(),
  );

  return {
    data: { user: sanitizedUser(user) },
    message: "Access token refreshed successfully",
    cookies: setAuthCookies(tokens),
  };
}

export async function currentUser(ctx: RequestContext): Promise<ActionResult> {
  return {
    data: { user: ctx.user },
    message: "Current user",
  };
}

export async function logout(ctx: RequestContext): Promise<ActionResult> {
  const refreshToken = ctx.cookies[REFRESH_TOKEN_COOKIE];

  // Best-effort server-side revocation. Logout must stay idempotent, so any
  // missing/invalid/expired token is ignored rather than rejected.
  if (refreshToken) {
    try {
      const decoded = verifyToken(refreshToken, env.JWT_REFRESH_SECRET);
      const user = await userService.findUserById(decoded.id);

      if (user && user.refreshToken === refreshToken) {
        await userService.updateRefreshToken(user.id, null, null);
      }
    } catch {
      // ignore: clearing the cookies below is what matters.
    }
  }

  return {
    data: {},
    message: "User logged out successfully",
    cookies: clearAuthCookies(),
  };
}

function sanitizedUser(user: Record<string, unknown>) {
  const { password, refreshToken, refreshTokenExpiresAt, ...rest } = user;

  return rest;
}

function buildTokenPayload(
  user: Pick<JwtPayload, "id" | "email" | "role" | "phone">,
): JwtPayload {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };
}

export function getRefreshTokenExpire(): Date {
  return expiresAtFromDuration(env.JWT_REFRESH_EXPIRE_AT, 7 * 24 * 60 * 60 * 1000);
}

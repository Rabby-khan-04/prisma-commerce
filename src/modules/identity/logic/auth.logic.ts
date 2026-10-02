import bcrypt from "bcryptjs";
import { env } from "../../../config/env";
import type { JwtPayload } from "../../../infra/auth";
import {
  generateRefreshToken,
  generateToken,
  verifyToken,
} from "../../../infra/auth/middleware";
import {
  AuthenticationError,
  ConflictError,
} from "../../../infra/errors/app-error";
import { generateResponse } from "../../../infra/utils/response";
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

export async function userRegister(body: UserRegisterBody) {
  const exist = await userService.findUserByEmail(body.email);
  if (exist) {
    throw new ConflictError(`Email already exists`);
  }

  const existUserName = await userService.findUserByUserName(body.username);

  if (existUserName)
    throw new ConflictError(`Username ${body.username} already exists`);

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

  const payload = buildTokenPayload(user);

  const { refreshToken, accessToken } = generateTokens(payload);

  await userService.updateRefreshToken(
    user.id,
    refreshToken,
    getRefreshTokenExpire(),
  );

  return generateResponse(
    { user: sanitizedUser(user), accessToken, refreshToken },
    "User created successfully",
  );
}

export async function userLogin(body: UserLoginBody) {
  const { identifier, password } = body;
  const user = await userService.findByIdentifier(identifier);

  const isValidPassword = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !isValidPassword) {
    throw new AuthenticationError("Invalid email/username or password");
  }

  const payload = buildTokenPayload(user);

  const { refreshToken, accessToken } = generateTokens(payload);

  await userService.updateRefreshToken(
    user.id,
    refreshToken,
    getRefreshTokenExpire(),
  );

  return generateResponse(
    { user: sanitizedUser(user), accessToken, refreshToken },
    "User logged in successfully",
  );
}

export async function refreshAccessToken(
  _body: unknown,
  _query: unknown,
  _user: unknown,
  cookies: { accessToken: string; refreshToken: string },
) {
  const decoded = verifyToken(cookies.refreshToken, env.JWT_REFRESH_SECRET);
  const user = await userService.findUserById(decoded.id);

  if (!user?.isActive) {
    throw new AuthenticationError("Account disabled");
  }

  if (!user || user.refreshToken !== cookies.refreshToken) {
    throw new AuthenticationError("Invalid refresh token");
  }

  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    await userService.updateRefreshToken(user.id, null, null);
    throw new AuthenticationError("Refresh token expired");
  }

  const payload = buildTokenPayload(user);
  const { refreshToken, accessToken } = generateTokens(payload);

  // rotate refresh token
  await userService.updateRefreshToken(
    user.id,
    refreshToken,
    getRefreshTokenExpire(),
  );

  return generateResponse(
    { accessToken, refreshToken },
    "Access token refreshed successfully",
  );
}

export async function logout(
  _body: unknown,
  _query: unknown,
  _user: unknown,
  cookies: { accessToken: string; refreshToken: string },
) {
  const decoded = verifyToken(cookies.refreshToken, env.JWT_REFRESH_SECRET);
  const user = await userService.findUserById(decoded.id);

  if (!user || user.refreshToken !== cookies.refreshToken) {
    throw new AuthenticationError("Invalid refresh token");
  }

  await userService.updateRefreshToken(user.id, null, null);
  return generateResponse(
    { accessToken: null, refreshToken: null },
    "User logged out successfully",
  );
}

function sanitizedUser(user: Record<string, unknown>) {
  const { password, refreshToken, refreshTokenExpiresAt, ...rest } = user;

  return rest;
}

function buildTokenPayload(user: JwtPayload) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };
}

type DurationUnit = "d" | "h" | "m" | "s";

function isDurationUnit(u: string | undefined): u is DurationUnit {
  return u === "d" || u === "h" || u === "m" || u === "s";
}

export function getRefreshTokenExpire(): Date {
  const expire = env.JWT_REFRESH_EXPIRE_AT;
  const match = expire.match(/^(\d+)([dhms])$/);

  if (!match || !isDurationUnit(match[2])) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1] as string);
  const unit = match[2];
  const ms: Record<DurationUnit, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };

  return new Date(Date.now() + value * ms[unit]);
}

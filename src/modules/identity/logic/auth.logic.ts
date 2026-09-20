import bcrypt from "bcryptjs";
import { env } from "../../../config/env";
import type { JwtPayload } from "../../../infra/auth";
import {
  generateRefreshToken,
  generateToken,
} from "../../../infra/auth/middleware";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from "../../../infra/errors/app-error";
import { generateResponse } from "../../../infra/utils/response";
import type { UserLoginBody, UserRegisterBody } from "../schemas/auth.schema";
import { userService } from "../services/user.service";

const SALT_ROUND = 12;

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

  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };

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

  if (!user) {
    throw new NotFoundError("User", identifier);
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    throw new AuthenticationError("Invalid email/username or password");
  }

  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    phone: user.phone,
  };

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

function sanitizedUser(user: Record<string, unknown>) {
  const { password, refreshToken, refreshTokenExpiresAt, ...rest } = user;

  return rest;
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

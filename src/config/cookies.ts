import type { CookieOptions } from "express";
import { env } from "./env";

const isProduction = env.NODE_ENV === "production";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
};

export const ACCESS_TOKEN_COOKIE = "accessToken" as const;
export const REFRESH_TOKEN_COOKIE = "refreshToken" as const;

export const accessCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};

export const refreshCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";
import { parseDurationToMs } from "../utils/duration";

const DAY = 24 * 60 * 60 * 1000;

const isProduction = env.NODE_ENV === "production";

export const ACCESS_TOKEN_COOKIE = "accessToken" as const;
export const REFRESH_TOKEN_COOKIE = "refreshToken" as const;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

// Cookie lifetimes are derived from the same env values as the JWTs, so the
// cookie, the token and the stored expiry can never drift apart.
export const accessCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRE_AT, DAY),
};

export const refreshCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRE_AT, 7 * DAY),
};

export interface CookieDirective {
  action: "set" | "clear";
  name: string;
  value?: string;
  options: CookieOptions;
}

/** Declarative cookie write. Pure: no `res` involved. */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions,
): CookieDirective {
  return { action: "set", name, value, options };
}

/** Declarative cookie removal. Pure: no `res` involved. */
export function clearCookie(
  name: string,
  options: CookieOptions,
): CookieDirective {
  return { action: "clear", name, options };
}

/** Set the auth cookies for a successful login/register/refresh. */
export function setAuthCookies(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): CookieDirective[] {
  const directives: CookieDirective[] = [];

  if (tokens.accessToken) {
    directives.push(
      setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessCookieOptions),
    );
  }

  if (tokens.refreshToken) {
    directives.push(
      setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshCookieOptions),
    );
  }

  return directives;
}

/** Clear both auth cookies. Used by logout. */
export function clearAuthCookies(): CookieDirective[] {
  return [
    clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions),
    clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions),
  ];
}

/** Apply declared cookie directives to the response. Transport concern. */
export function applyCookieDirectives(
  res: Response,
  directives: CookieDirective[],
): void {
  for (const directive of directives) {
    if (directive.action === "set") {
      res.cookie(directive.name, directive.value ?? "", directive.options);
    } else {
      res.clearCookie(directive.name, directive.options);
    }
  }
}

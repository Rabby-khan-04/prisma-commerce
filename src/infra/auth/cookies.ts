import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";

const isProduction = env.NODE_ENV === "production";
export const ACCESS_TOKEN_COOKIE = "accessToken" as const;
export const REFRESH_TOKEN_COOKIE = "refreshToken" as const;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export const accessCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: 12 * 60 * 60 * 1000,
};

export const refreshCookieOptions: CookieOptions = {
  ...baseCookieOptions,

  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export interface CookieDirective {
  action: "set" | "clear";
  name: string;
  value?: string;
  options: CookieOptions;
}

export function setCookie(
  name: string,
  value: string,
  options: CookieOptions,
): CookieDirective {
  return { action: "set", value, name, options };
}

export function clearCookie(
  name: string,
  options: CookieOptions,
): CookieDirective {
  return { action: "clear", name, options };
}

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
      setCookie(
        REFRESH_TOKEN_COOKIE,
        tokens.refreshToken,
        refreshCookieOptions,
      ),
    );
  }

  return directives;
}

export function clearAuthCookies(): CookieDirective[] {
  return [
    clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions),
    clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions),
  ];
}

export function applyCookieDirectives(
  res: Response,
  directives: CookieDirective[],
): void {
  for (const directive of directives) {
    if (directive.action === "set") {
      res.cookie(directive.name, directive.value, directive.options);
    } else {
      res.clearCookie(directive.name, directive.options);
    }
  }
}

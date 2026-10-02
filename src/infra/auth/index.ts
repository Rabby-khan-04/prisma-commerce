export type { AuthenticatedRequest, JwtPayload, UserRole } from "./types";

export { authenticate, optionalAuthenticate } from "./middleware";

export { generateRefreshToken, generateToken, verifyToken } from "./tokens";

export type { CookieDirective } from "./cookies";
export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  applyCookieDirectives,
  clearAuthCookies,
  clearCookie,
  refreshCookieOptions,
  setAuthCookies,
  setCookie,
} from "./cookies";

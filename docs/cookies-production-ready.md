# Cookies — every feature + production-ready setup

This is the reference companion to
[`cookies-explained.md`](./cookies-explained.md). Part A catalogues **all cookie
functionality** you can use. Part B turns the project's current cookie setup into
a **hardened, production-ready** design, with code that fits this codebase
(Express 5 + Prisma 7 + Zod 4 + Bun).

---

# Part A — Every cookie feature

## A1. Attribute reference

| Attribute   | Values                              | Default here        | Production value / note                                    |
| ----------- | ----------------------------------- | ------------------- | ---------------------------------------------------------- |
| `name`      | any token, case-sensitive           | `accessToken` etc.  | Prefer `__Host-` / `__Secure-` prefixes (see A3)           |
| `value`     | string, no `;` `,` space or control | JWT                 | Use `encodeURIComponent` if arbitrary                         |
| `Domain`    | hostname                            | omitted (host-only) | **Omit** with `__Host-`; set only if subdomains must share  |
| `Path`      | URL path                            | `/`                 | `__Host-` **requires** `/`                                 |
| `Expires`   | HTTP date                           | —                   | Absolute; avoid (use `Max-Age`)                            |
| `Max-Age`   | seconds                             | token lifetime      | Negative/0 deletes; `< 0` also treats as session           |
| `Secure`    | flag                                | `isProduction`      | **Always on** in production                                |
| `HttpOnly`  | flag                                | `true`              | `true` for tokens, `false` only for CSRF cookie            |
| `SameSite`  | `Strict` / `Lax` / `None`           | `Lax`               | `Lax` same-site; `None` needs `Secure` + CSRF defense      |
| `Partitioned`| flag                              | off                 | For third-party embeds (CHIPS); requires `Secure`          |
| `Priority`  | `Low` / `Medium` / `High`           | off                 | Eviction hint for important cookies (`High` for refresh)   |

## A2. Cookie kinds / behaviors

### Session vs persistent

- **Session cookie**: no `Max-Age`/`Expires` → deleted when the browser closes.
- **Persistent cookie**: has `Max-Age`/`Expires` → survives restarts.

This project makes both auth cookies **persistent** (time-boxed by env).

### Host-only vs domain cookie

- **No `Domain`** → host-only: sent only to the exact host that set it. Most secure.
- **`Domain=example.com`** → also sent to every subdomain (`shop.example.com`).
  Convenient for multi-service apps, but a compromised subdomain can read them.
  Not allowed with the `__Host-` prefix.

### First-party vs third-party vs partitioned (CHIPS)

- **First-party**: cookie's site == page's site. Normal case here.
- **Third-party**: set by another site (e.g. embedded widget). Being blocked by
  browsers; requires `SameSite=None; Secure`.
- **Partitioned (`Partitioned`)**: stored under a (top-site, embedded-site) pair,
  so an embedded service can use cookies without cross-site tracking. Requires
  `Secure`.

### Signed and JSON cookies (`cookie-parser`)

`cookieParser(secret)` gives two extra superpowers:

```ts
app.use(cookieParser(env.COOKIE_SECRET));

res.cookie("cart", { items: 3 }, { signed: true });  // → s:<value>.<hmac>
req.signedCookies.cart;                               // undefined if tampered
req.cookies.cart;                                     // still the raw value
```

- **Signed cookies** detect tampering (integrity), they do **not** hide the value.
  Use for non-sensitive data you must trust (e.g. a CSRF token or cart id).
- **JSON cookies**: pass an object; serialized with `j:` prefix and parsed back.
- `cookieParser(secret)` also accepts an **array of secrets** to rotate signing
  keys (new secret first; old ones still verify).

### Reading, setting, deleting

```ts
req.cookies.name;             // read (all cookies)
req.signedCookies.name;       // read (signed only)
res.cookie(name, value, opts);      // set
res.clearCookie(name, opts);        // delete: expired Set-Cookie with matching attributes
res.cookie(name, "", { ...opts, maxAge: 0 }); // equivalent delete
```

> Deletion only works if `Path`/`Domain`/`Secure`/`SameSite` match the original
> cookie. That's the single most common cookie bug.

### Setting many cookies & overriding

`Set-Cookie` is a repeatable header — call `res.cookie` once per cookie. Setting
the same name+path+domain again **replaces** it. Different `Path` values coexist
and are all sent if they match the request.

### Limits

- ~**4 KB** per cookie (name + value + attributes).
- ~**50 cookies** per domain (browser-dependent).
- Cookies are sent on **every** matching request — keep them tiny; never store
  JWTs larger than needed. This is why access tokens are short-lived and refresh
  tokens live server-side.

### Security prefixes (browser-enforced)

| Prefix       | Rules the browser enforces                                     |
| ------------ | -------------------------------------------------------------- |
| `__Secure-`  | Must be set with `Secure`.                                     |
| `__Host-`    | Must be `Secure`, `Path=/`, and **no `Domain`** (host-only).   |

`__Host-` is the strongest: it prevents a subdomain from overwriting the cookie
(cookie tossing / fixation) and prevents domain-wide leakage. Names are
case-sensitive (`__Host-` exactly).

## A3. Threats cookies face, and the defense

| Threat               | What it is                                                   | Defense                                                       |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| **XSS token theft**  | Injected JS reads `document.cookie` and steals tokens        | `HttpOnly`; CSP; never put tokens in JS-readable storage      |
| **CSRF**             | Another site makes the browser send your cookie on a request | `SameSite=Lax/Strict`; CSRF token when `SameSite=None`        |
| **Session fixation** | Attacker plants a known cookie before login                  | Regenerate/rotate tokens on login; `__Host-` prefix           |
| **Cookie tossing**   | A subdomain sets a same-named cookie to shadow the parent    | `__Host-` prefix (no `Domain`)                                |
| **Network sniffing** | Token read off plain HTTP                                    | `Secure`; HTTPS everywhere; HSTS                              |
| **Replay**           | Stolen token reused                                          | Short access TTL; refresh **rotation** + reuse detection      |
| **Leak via subdomain**| `Domain=.example.com` cookie sent to a compromised subdomain | Host-only cookies; avoid broad `Domain` in prod               |
| **Overly long life** | Stolen cookie valid for months                               | Short access TTL; server-side refresh expiry; sliding sessions|

---

# Part B — Production-ready setup

The current design is solid; Part B upgrades four things:

1. **Prefixes + config-driven attributes** so cookies are as safe as browsers allow.
2. **CSRF protection** for the `SameSite=None` case (separate frontend domain).
3. **Hashed refresh tokens + session table + reuse detection** (replacing the raw
   token column).
4. **Operational hardening** (proxy/TLS, secrets, rate limits, rotation, CORS).

## B1. Environment additions

`src/config/env.ts`:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRE_AT: z.string(),   // e.g. "15m"
  JWT_REFRESH_EXPIRE_AT: z.string(),  // e.g. "7d"

  // --- cookies ---
  COOKIE_SECRET: z.string().min(32),                 // signs non-HttpOnly cookies
  COOKIE_DOMAIN: z.string().optional(),              // omit for __Host-
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true")
    .default(true),
});
```

> `JWT_*_SECRET` and `COOKIE_SECRET` must be long, random, and stored in a secret
> manager (never committed). Rotate them periodically (see B6).

## B2. Config-driven cookie factory with prefixes

Replace the hard-coded options in `src/infra/auth/cookies.ts` with a single
factory. The names change by environment so `__Host-` is only used when it's
safe (HTTPS + no domain).

```ts
import type { CookieOptions } from "express";
import { env } from "../../config/env";
import { parseDurationToMs } from "../utils/duration";

const DAY = 24 * 60 * 60 * 1000;
const isProd = env.NODE_ENV === "production";

// __Host- requires Secure + Path=/ + no Domain. Only use it in prod, HTTPS, and
// when we are NOT sharing across subdomains.
const useHostPrefix = isProd && env.COOKIE_SECURE && !env.COOKIE_DOMAIN;
const prefix = useHostPrefix ? "__Host-" : "";

export const ACCESS_TOKEN_COOKIE = `${prefix}access_token` as const;
export const REFRESH_TOKEN_COOKIE = `${prefix}refresh_token` as const;
export const CSRF_COOKIE = isProd ? "__Host-csrf_token" : "csrf_token" as const;

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd ? true : env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: "/",
    ...(env.COOKIE_DOMAIN && !useHostPrefix ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export const accessCookieOptions: CookieOptions = {
  ...baseOptions(),
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRE_AT, 15 * 60 * 1000),
  priority: "high",
};

export const refreshCookieOptions: CookieOptions = {
  ...baseOptions(),
  maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRE_AT, 7 * DAY),
  priority: "high",
};

// CSRF cookie MUST be readable by JS (frontend echoes it in a header), so it is
// NOT HttpOnly — but it must be Secure + scoped to the API path.
export const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: isProd,
  sameSite: env.COOKIE_SAMESITE,
  path: "/",
};
```

Everything else in the project (`setCookie`, `clearCookie`, `setAuthCookies`,
`clearAuthCookies`, `applyCookieDirectives`) stays the same — that's the payoff of
the declarative design: only the options factory changes.

> **Important:** when migrating cookie names (`accessToken` → `__Host-access_token`),
> clear the old names once too, or users may end up with both. See B7.

## B3. CSRF protection (only needed when `SameSite=None`)

If the frontend is on a different site and you must use `SameSite=None; Secure`,
add **HMAC-signed double-submit tokens**:

```ts
// src/infra/auth/csrf.ts
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { AuthenticationError, AuthorizationError } from "../errors/app-error";
import { CSRF_COOKIE, csrfCookieOptions, setCookie } from "./cookies";

const HEADER = "x-csrf-token";

function sign(raw: string): string {
  return crypto.createHmac("sha256", env.COOKIE_SECRET).update(raw).digest("base64url");
}

export function issueCsrfToken(): string {
  const raw = crypto.randomBytes(32).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

export function csrfCookieDirective(token: string) {
  return setCookie(CSRF_COOKIE, token, csrfCookieOptions);
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  try {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    const header = req.header(HEADER);
    if (!cookie || !header) throw new AuthorizationError("CSRF token missing");
    if (!crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
      throw new AuthorizationError("CSRF token mismatch");
    }
    next();
  } catch (err) {
    next(err instanceof Error ? err : new AuthenticationError());
  }
}
```

Wire it:

```ts
// issue the token on every response that establishes/refreshes a session
const auth = new AuthenticationError(); // (only if you want to gate it)
return {
  data: { user },
  cookies: [...setAuthCookies(tokens), csrfCookieDirective(issueCsrfToken())],
};

// protect state-changing routes
router.post("/logout", requireCsrf, controller(logout));
router.patch("/products/:id", authenticate, requireCsrf, /* ... */);
```

Rules:

- Only **mutating** methods need CSRF (POST/PUT/PATCH/DELETE).
- Safe methods (GET/HEAD) must never change state.
- With `SameSite=Strict`, CSRF is largely unnecessary; `Lax` covers most cases;
  `None` **requires** this defense.
- Keep the CSRF cookie **non-HttpOnly** (the frontend must read it) but still
  `Secure` and host-scoped. The HMAC stops subdomains from forging it.

## B4. Hashed refresh tokens + sessions + reuse detection

The current schema stores the raw refresh token on `User`. Upgrade to a
dedicated session table and store only a **hash**. Add:

```prisma
model Session {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  tokenHash         String   @unique @map("token_hash") @db.VarChar(255)
  familyId          String   @map("family_id") @db.Uuid
  userAgent         String?  @map("user_agent") @db.VarChar(512)
  ip                String?  @db.VarChar(64)
  expiresAt         DateTime @map("expires_at") @db.Timestamptz
  revokedAt         DateTime? @map("revoked_at") @db.Timestamptz
  replacedByHash    String?  @map("replaced_by_hash") @db.VarChar(255)
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@map("sessions")
}
```

Add `sessions Session[]` to `User` and drop the raw `refreshToken` /
`refreshTokenExpiresAt` columns (after migration).

```ts
// src/infra/auth/session.ts
import crypto from "node:crypto";
import { prisma } from "../../config/prisma";

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(opts: {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  familyId?: string;
  userAgent?: string;
  ip?: string;
}) {
  return prisma.session.create({
    data: {
      userId: opts.userId,
      tokenHash: hashToken(opts.refreshToken),
      familyId: opts.familyId ?? crypto.randomUUID(),
      expiresAt: opts.expiresAt,
      userAgent: opts.userAgent,
      ip: opts.ip,
    },
  });
}

export async function rotateSession(oldToken: string, newToken: string, newExpiresAt: Date) {
  const hash = hashToken(oldToken);
  const existing = await prisma.session.findUnique({ where: { tokenHash: hash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) return null;

  const newHash = hashToken(newToken);

  // Reuse detection: a token that was already replaced means theft → kill family.
  if (existing.replacedByHash && existing.replacedByHash !== newHash) {
    await prisma.session.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  await prisma.session.update({
    where: { id: existing.id },
    data: { replacedByHash: newHash, revokedAt: new Date() },
  });

  await createSession({
    userId: existing.userId,
    refreshToken: newToken,
    expiresAt: newExpiresAt,
    familyId: existing.familyId,
  });

  return existing.userId;
}
```

Why this is better:

- **DB leak ≠ token leak:** only SHA-256 hashes are stored.
- **Reuse detection:** replaying a rotated token revokes the entire token family
  (all devices for that login chain), forcing re-auth.
- **Per-device sessions:** you can list and revoke individual devices.
- **"Logout everywhere":** `updateMany({ where: { userId }, data: { revokedAt } })`.

Use an **opaque random refresh token** (or add a `jti` to the JWT) so each
refresh is uniquely identifiable in the DB. Keep the access token as a short
stateless JWT.

## B5. Auth flow with all of the above

```ts
// login (simplified)
const { accessToken, refreshToken } = generateTokens(buildTokenPayload(user));
await createSession({
  userId: user.id,
  refreshToken,
  expiresAt: getRefreshTokenExpire(),
  userAgent: ctx.userAgent,
  ip: ctx.ip,
});

return {
  data: { user: sanitizedUser(user) },
  message: "User logged in successfully",
  cookies: [
    ...setAuthCookies({ accessToken, refreshToken }),
    csrfCookieDirective(issueCsrfToken()),
  ],
};

// refresh
const presented = ctx.cookies[REFRESH_TOKEN_COOKIE];
if (!presented) throw new AuthenticationError("Refresh token missing");

const decoded = verifyToken(presented, env.JWT_REFRESH_SECRET);
const tokens = generateTokens(buildTokenPayload(decoded));

const userId = await rotateSession(presented, tokens.refreshToken, getRefreshTokenExpire());
if (!userId) throw new AuthenticationError("Invalid refresh token");

return {
  data: {},
  message: "Access token refreshed successfully",
  cookies: [
    ...setAuthCookies(tokens),
    csrfCookieDirective(issueCsrfToken()),
  ],
};

// logout (this device)
await prisma.session.updateMany({
  where: { userId },
  data: { revokedAt: new Date() },
});
return { data: {}, message: "Logged out", cookies: clearAuthCookies() };
```

## B6. Operational hardening

### TLS, proxy, and `Secure`

- Terminate TLS at the proxy and serve **HTTPS only**; redirect HTTP → HTTPS.
- `app.set("trust proxy", 1)` is already set, so `req.ip` and `secure` detection
  work behind one proxy. Set the correct number of hops for your topology.
- Send **HSTS** (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
  via a proxy or `helmet`. Without HTTPS, `Secure` cookies vanish.

```bash
bun add helmet
```

```ts
import helmet from "helmet";
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
```

### CORS (already partly correct)

`credentials: true` is set. In production:

- Keep an explicit **allow-list** (no `*`, no reflection of arbitrary origins).
- Echo only origins you own; add `Vary: Origin`.
- Allow the CSRF header: `allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"]`.
- `SameSite=None` also needs `Secure`, and cross-site cookies need the frontend
  and API to share a **site** (or use the CSRF token).

```ts
allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
```

### Rate limiting & lockout

Protect `/login` and `/refresh` with IP + account rate limits (e.g.
`rate-limiter-flexible` or `express-rate-limit`) to blunt credential stuffing and
refresh brute force. Lock or back off after repeated failures.

### Secrets & key rotation

- Source secrets from a manager (Vault/AWS Secrets Manager/Doppler), not `.env`
  in prod images.
- Rotate signing keys: accept old + new for a window, then drop the old.
  `cookie-parser` supports an array of secrets for this exact reason.
- Never log cookies or `Set-Cookie` headers. Redact `Cookie`/`Authorization` in
  request logs.

### Lifetime alignment

Keep the three expiry sources equal, as the project already does:
cookie `maxAge` = JWT `exp` = DB `expiresAt`. Add **sliding sessions** only if you
want active users to stay logged in: refresh extends the DB expiry, but cap it
with an absolute maximum (e.g. 30 days).

### Input & header hygiene

- `express.json({ limit: "16kb" })` is already limited — good.
- Set `Cache-Control: no-store` on auth responses so tokens aren't cached.
- Reject unexpected `Host` headers at the proxy.

## B7. Migration checklist (from current to production)

1. Add `COOKIE_SECRET`, `COOKIE_DOMAIN`, `COOKIE_SAMESITE`, `COOKIE_SECURE` to env.
2. Switch cookie names to `__Host-*` behind the config flag (B2).
3. On the first deploy with new names, **clear the legacy** `accessToken` /
   `refreshToken` cookies once (call `res.clearCookie` for the old names in
   login/logout) to avoid duplicates.
4. Add the `Session` model; migrate existing `User.refreshToken` values into it
   (hashed), then drop the columns.
5. Require `Secure` + HTTPS in production; enable HSTS.
6. If the frontend is cross-site: `SameSite=None` + CSRF middleware + expose the
   CSRF cookie (non-HttpOnly).
7. Add rate limiting to `/login`, `/refresh`, and any token-issuing route.
8. Add `requireCsrf` to all mutating auth routes.
9. Add monitoring: alert on refresh-reuse events (possible theft) and spikes in
   401s from `/refresh`.
10. Delete secrets from the repo; move them to the secret manager.

## B8. Production verification checklist

- [ ] Cookies show `Secure; HttpOnly; SameSite=...; Path=/` (and `__Host-` where applicable).
- [ ] `document.cookie` does **not** expose access/refresh tokens.
- [ ] After refresh, the old refresh token no longer works and a replayed one
      revokes the session family.
- [ ] Logout clears cookies and revokes the DB session; a second logout still 204/200.
- [ ] `curl` over HTTP cannot receive `Secure` cookies in production.
- [ ] CORS returns credentials only for allow-listed origins.
- [ ] CSRF: a POST without the header is rejected when `SameSite=None`.
- [ ] Secrets are 32+ chars, from a secret manager, and rotatable.
- [ ] Auth responses set `Cache-Control: no-store`.
- [ ] Rate limits active on login/refresh; logs redact cookie headers.

## B9. TL;DR

- Use `__Host-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` cookies for tokens.
- Short access JWT + long **hashed** refresh token in a session table.
- Rotate refresh tokens and detect reuse; keep a per-device session family.
- Add CSRF protection only when you need `SameSite=None`.
- Serve everything over HTTPS; keep secret material in a manager; rate-limit auth.
- Keep cookie lifetime, JWT `exp`, and DB expiry derived from the same env values.

Related: [`cookies-explained.md`](./cookies-explained.md) ·
[`controller-guide.md`](./controller-guide.md)

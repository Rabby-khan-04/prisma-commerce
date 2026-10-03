# Cookies in this project — explained from scratch

This document teaches **how cookies actually work** and then walks through
**exactly how this project sets them up**, file by file, line by line. Read it
top to bottom.

For a catalogue of every cookie feature and a hardened production setup, see
[`cookies-production-ready.md`](./cookies-production-ready.md).

---

## 1. What a cookie is

A cookie is a small `name=value` string that a **server asks a browser to store**,
and that the **browser automatically sends back** on later requests to that
server. It is the oldest and still most common way to keep a user "logged in"
across HTTP requests, because HTTP itself is **stateless** — each request knows
nothing about the previous one.

Two facts to burn in:

1. The **browser** stores cookies. `curl`/Postman only store them if you tell
   them to. In this project the server sends cookies, and a real browser
   (the frontend) keeps and replays them.
2. The browser sends cookies **automatically**; JavaScript must *not* be able to
   read the sensitive ones. That's what `HttpOnly` prevents.

### Where cookies live on the wire

The server sends one response header per cookie:

```http
Set-Cookie: accessToken=eyJhbGci...; Max-Age=900; Path=/; HttpOnly; SameSite=Lax
Set-Cookie: refreshToken=eyJhbGci...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
```

The browser later sends them back bundled into a single request header:

```http
Cookie: accessToken=eyJhbGci...; refreshToken=eyJhbGci...
```

So the lifecycle is:

```
POST /login  ──►  server creates JWTs  ──►  Set-Cookie: accessToken, refreshToken
                                              │
                                              ▼
                                        browser stores them
                                              │
GET /me  ──►  Cookie: accessToken=...  ──►  server verifies, returns the user
```

---

## 2. Cookie anatomy

Every `Set-Cookie` is one `name=value` pair plus optional **attributes** that are
instructions to the browser:

```http
Set-Cookie: <name>=<value>; Domain=...; Path=...; Expires=...; Max-Age=...;
            Secure; HttpOnly; SameSite=Lax; Partitioned; Priority=High
```

| Attribute   | Meaning (browser instruction)                                              |
| ----------- | -------------------------------------------------------------------------- |
| `name=value`| The data. Name is unique per (domain, path).                               |
| `Domain`    | Which hosts receive it. Omit → host-only (only the exact host).            |
| `Path`      | Which URL paths receive it. Default is the request's directory.            |
| `Expires`   | Absolute expiry date.                                                     |
| `Max-Age`   | Relative expiry in **seconds** (wins over `Expires` when both are present).|
| `Secure`    | Only send over HTTPS.                                                      |
| `HttpOnly`  | Hide from `document.cookie` (JavaScript cannot read it).                   |
| `SameSite`  | Whether to send on cross-site requests: `Strict`, `Lax`, or `None`.        |
| `Partitioned`| Store per top-level site (CHIPS).                                         |
| `Priority`  | Browser eviction hint: `Low`, `Medium`, `High`.                            |

In this project, `cookie-parser` turns the incoming `Cookie` header into a plain
object at `req.cookies`, and `res.cookie(...)` writes the outgoing `Set-Cookie`
headers. That's it — everything below is built on these two primitives.

---

## 3. The layers involved in this project

```
app.ts
  └─ app.use(cookieParser())            ← parse incoming Cookie header → req.cookies
  └─ app.use(configCors())              ← credentials: true, so browsers send/receive cookies

infra/auth/cookies.ts                   ← the cookie toolkit (constants, options, directives)
infra/controllers/index.ts              ← copies req.cookies into ctx, applies result.cookies
infra/auth/middleware.ts                ← reads the access cookie to authenticate
modules/identity/logic/auth.logic.ts    ← decides WHEN to set/clear and returns directives
modules/identity/routes/auth.routes.ts  ← wires routes to handlers
prisma/schema.prisma                    ← stores the refresh token per user
```

The big idea: **business logic never touches `res`.** Instead of calling
`res.cookie(...)` inside a handler, a handler returns a list of *cookie
directives*, and the transport layer applies them. This keeps the logic testable
and framework-agnostic.

---

## 4. `cookie-parser` — reading cookies

`src/app.ts`:

```ts
import cookieParser from "cookie-parser";
// ...
app.use(cookieParser());
```

- **Input:** `Cookie: accessToken=abc; refreshToken=def`
- **Output:** `req.cookies = { accessToken: "abc", refreshToken: "def" }`

Without this middleware, `req.cookies` would be `undefined`, and every piece of
auth code here (which reads `ctx.cookies`) would break. The controller guards it
anyway with `req.cookies ?? {}`.

CORS also matters: `credentials: true` in `src/config/cors.ts` is what allows a
browser on another origin to **send** cookies and **read** the `Set-Cookie`
response. Note that when using credentials you cannot use `origin: "*"`; this
project uses an allow-list instead.

---

## 5. The cookie toolkit — `src/infra/auth/cookies.ts`

### 5.1 Cookie names

```ts
export const ACCESS_TOKEN_COOKIE = "accessToken" as const;
export const REFRESH_TOKEN_COOKIE = "refreshToken" as const;
```

Two cookies, two jobs:

| Cookie         | Holds                  | Lifetime | Purpose                                  |
| -------------- | ---------------------- | -------- | ---------------------------------------- |
| `accessToken`  | short-lived JWT        | `JWT_ACCESS_EXPIRE_AT`  | authenticate each request   |
| `refreshToken` | long-lived JWT         | `JWT_REFRESH_EXPIRE_AT` | obtain new access tokens    |

### 5.2 Shared base options

```ts
const DAY = 24 * 60 * 60 * 1000;
const isProduction = env.NODE_ENV === "production";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,          // JS cannot read it → mitigates XSS token theft
  secure: isProduction,    // HTTPS-only in production; allowed over HTTP in dev
  sameSite: "lax",         // not sent on most cross-site requests → CSRF mitigation
  path: "/",               // valid for the whole site
};
```

One base, two derived options:

```ts
export const accessCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRE_AT, DAY),
};

export const refreshCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRE_AT, 7 * DAY),
};
```

**Why `maxAge` derived from env?** The cookie's lifetime, the JWT's `exp`, and the
DB column `refreshTokenExpiresAt` are all computed from the **same** env values
(`JWT_ACCESS_EXPIRE_AT`, `JWT_REFRESH_EXPIRE_AT`). If you changed only one of
them by hand, a cookie could outlive its token or vice-versa. Here they can never
drift apart. `parseDurationToMs` understands `"15m"`, `"24h"`, `"7d"`, `"30s"`.

> `secure: isProduction` means: in dev over `http://localhost` cookies still work;
> in production `Secure` is on, so **you must serve over HTTPS** or the browser
> will silently drop the cookies.

### 5.3 The declarative directive

```ts
export interface CookieDirective {
  action: "set" | "clear";
  name: string;
  value?: string;
  options: CookieOptions;
}

export function setCookie(name, value, options): CookieDirective {
  return { action: "set", name, value, options };
}

export function clearCookie(name, options): CookieDirective {
  return { action: "clear", name, options };
}
```

These are **pure functions** — no `res`, no side effects. They just describe an
intention. This is the seam that lets logic stay transport-agnostic.

### 5.4 High-level helpers

```ts
export function setAuthCookies(tokens): CookieDirective[] {
  const directives = [];
  if (tokens.accessToken)
    directives.push(setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessCookieOptions));
  if (tokens.refreshToken)
    directives.push(setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshCookieOptions));
  return directives;
}

export function clearAuthCookies(): CookieDirective[] {
  return [
    clearCookie(ACCESS_TOKEN_COOKIE, accessCookieOptions),
    clearCookie(REFRESH_TOKEN_COOKIE, refreshCookieOptions),
  ];
}
```

Note they are conditional: pass only an access token and only that cookie is set.
Both are used by auth logic.

### 5.5 Applying directives to the response

```ts
export function applyCookieDirectives(res: Response, directives: CookieDirective[]): void {
  for (const directive of directives) {
    if (directive.action === "set") {
      res.cookie(directive.name, directive.value ?? "", directive.options);
    } else {
      res.clearCookie(directive.name, directive.options);
    }
  }
}
```

This is the **only** place that calls `res.cookie` / `res.clearCookie`.

> **Clearing cookies correctly:** `res.clearCookie` sends an *expired* `Set-Cookie`
> with the **same path/domain attributes**. That's why `clearCookie` receives the
> options too — if the path/domain didn't match the original cookie's, the browser
> would keep the old cookie. This project reuses `accessCookieOptions` /
> `refreshCookieOptions` so attributes always match.

---

## 6. How the controller connects `ctx.cookies` and `result.cookies`

`src/infra/controllers/index.ts`:

```ts
const ctx = {
  body: req.body,
  query: req.query,
  params: req.params,
  cookies: (req.cookies ?? {}) as Record<string, string | undefined>, // read side
  user: (req as AuthenticatedRequest).user,
};

const result = await handler(ctx);

if (!result) return res.status(204).send();

if (result.cookies?.length) {
  applyCookieDirectives(res, result.cookies);   // write side
}
```

So a handler:

- **reads** cookies from `ctx.cookies`
- **writes** cookies by putting `cookies: [...]` in its `ActionResult`

Nothing else in a handler needs to know cookies exist.

---

## 7. End-to-end flows (the heart of this doc)

All handlers live in `src/modules/identity/logic/auth.logic.ts` and are wired in
`src/modules/identity/routes/auth.routes.ts`.

### 7.1 Register — `POST /api/v1/auth/register`

```
1. validate(userRegistrationSchema, "body")
2. controller(userRegister)
3. userRegister(ctx):
     - checks email/username uniqueness
     - bcrypt.hash(password, 12)
     - creates the user
     - generateTokens(user)  → { accessToken, refreshToken }   (JWTs)
     - stores refreshToken + refreshTokenExpiresAt in the DB
     - returns { data, message, status: 201, cookies: setAuthCookies(tokens) }
4. controller applies the directives → two Set-Cookie headers, responds 201
```

### 7.2 Login — `POST /api/v1/auth/login`

```
- find user by email or username
- bcrypt.compare with a dummy hash when the user is missing
  (so both failure paths take the same time and don't leak account existence)
- if bad → throw AuthenticationError (401), no cookies set
- if good → generateTokens → persist refresh token → setAuthCookies
```

### 7.3 Authenticated request — `GET /api/v1/auth/me`

Route chain: `authenticate` → `controller(currentUser)`.

`src/infra/auth/middleware.ts` extracts the token **cookie first, then
`Authorization: Bearer`**:

```ts
function extractAccessToken(req: Request): string | undefined {
  const cookies = req.cookies;
  const cookieToken = cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;                    // browsers

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim(); // API clients

  return undefined;
}
```

Then it verifies the JWT and sets `req.user`, which the controller copies into
`ctx.user`:

```ts
(req as AuthenticatedRequest).user = verifyToken(token, env.JWT_ACCESS_SECRET);
```

This dual read (cookie OR bearer) is deliberate: browser clients use cookies,
mobile/CLI clients can use a header, and the same endpoint serves both.

### 7.4 Refresh — `POST /api/v1/auth/refresh`

```
1. read ctx.cookies.refreshToken      (no body needed)
2. verifyToken(refreshToken, JWT_REFRESH_SECRET)
3. load user; must exist and be active
4. IMPORTANT: user.refreshToken must equal the presented token
       → detects replay of an old/rotated token
5. check refreshTokenExpiresAt is in the future
6. issue NEW access + refresh tokens, persist the new refresh token (rotation)
7. setAuthCookies(newTokens)
```

This is **refresh-token rotation**: every refresh replaces the stored refresh
token. If an attacker replays a stolen-but-superseded token, step 4 fails. If
the stored expiry has passed, the token is nulled and the request is rejected.

### 7.5 Logout — `POST /api/v1/auth/logout`

```
1. read ctx.cookies.refreshToken
2. best-effort server-side revocation:
     verify it; if it matches the DB, set refresh_token = null
     (all wrapped in try/catch — an invalid/missing token is ignored)
3. ALWAYS return cookies: clearAuthCookies()  → two expired Set-Cookie headers
```

Two-part logout:

- **Server side:** nulling the stored refresh token means it can't be reused even
  if the cookie were somehow kept.
- **Client side:** clearing the cookies removes them from the browser. Logout
  stays idempotent — calling it twice is fine.

### 7.6 Token timeline

```
t=0        login            accessToken(15m) + refreshToken(7d) issued & persisted
t=14m      GET /me          accessToken valid
t=16m      GET /me          accessToken expired → client calls POST /refresh
t=16m      POST /refresh    refreshToken valid → NEW pair issued, DB updated
t=7d+      POST /refresh    refreshToken expired/mismatch → 401, must log in again
```

---

## 8. Where the refresh token is persisted

`prisma/schema.prisma`:

```prisma
model User {
  // ...
  refreshToken          String?   @map("refresh_token")
  refreshTokenExpiresAt DateTime? @map("refresh_token_expires_at")
}
```

`refreshTokenExpiresAt` is computed by `getRefreshTokenExpire()`:

```ts
export function getRefreshTokenExpire(): Date {
  return expiresAtFromDuration(env.JWT_REFRESH_EXPIRE_AT, 7 * 24 * 60 * 60 * 1000);
}
```

Updates use raw SQL in `user.service.ts`:

```ts
async updateRefreshToken(id, token, expireAt) {
  return prisma.$executeRaw`
    UPDATE "users"
    SET "refresh_token" = ${token}, "refresh_token_expires_at" = ${expireAt}
    WHERE id = ${id}::uuid
  `;
}
```

So the DB is the **source of truth** for "is this refresh token still allowed?",
independent of the JWT's own signature/expiry. That is what makes rotation and
server-side revocation possible.

---

## 9. JWT + cookie: which layer enforces what

| Concern                       | Enforced by                                  |
| ----------------------------- | -------------------------------------------- |
| Is the access token authentic?| JWT signature (`verifyToken`)                |
| Is the access token fresh?    | JWT `exp` (short)                            |
| Is the refresh token authentic?| JWT signature                               |
| Is the refresh token allowed? | DB equality + DB expiry (rotation/revocation)|
| Can JS steal the token?       | `HttpOnly` cookie                            |
| Can it leak over plain HTTP?  | `Secure` cookie (production)                 |
| Can another site trigger calls?| `SameSite=lax` + CORS allow-list            |

---

## 10. Common questions

**Why two tokens instead of one long-lived cookie?**
A long-lived token that's checked on every request is dangerous if stolen. So:
short access token (cheap to check via signature, expires fast) + long refresh
token (checked against the DB, rotates). You get speed *and* revocability.

**Why store the refresh token in the DB at all if it's a signed JWT?**
Signature proves it was *issued*, not that it's *still valid*. DB storage enables
rotation, "logout everywhere", and immediate revocation.

**Why `sameSite: "lax"` and not `"strict"`?**
`lax` still sends cookies on top-level navigations (clicking a link to your site)
so users stay logged in, while blocking most cross-site form POSTs. `strict`
would break normal link-based navigation.

**Why can't I see the cookie value in JS?**
`httpOnly: true`. That's intentional — it defends against XSS reading tokens.
Your frontend should never need the raw token; it just lets the browser send it.

**What does `credentials: true` CORS do?**
Tells the browser it may include cookies on cross-origin requests and lets the
frontend read the response. Without it, cross-origin cookie auth silently fails.

**Why does logout work even without a valid refresh token?**
Logout is idempotent by design: it clears cookies unconditionally and only tries
server revocation best-effort. A user should always be able to log out.

---

## 11. File map (cookie-relevant)

| File                                         | Role                                             |
| -------------------------------------------- | ------------------------------------------------ |
| `src/app.ts`                                 | `cookieParser()`, CORS, JSON body                |
| `src/config/cors.ts`                         | `credentials: true` + origin allow-list          |
| `src/infra/auth/cookies.ts`                  | names, options, directives, apply/clear helpers  |
| `src/infra/auth/middleware.ts`               | reads access cookie (or Bearer) → `req.user`     |
| `src/infra/auth/tokens.ts`                   | signs/verifies JWTs                              |
| `src/infra/controllers/index.ts`             | `ctx.cookies` in, `result.cookies` out           |
| `src/modules/identity/logic/auth.logic.ts`   | when to set/rotate/clear                         |
| `src/modules/identity/routes/auth.routes.ts` | route wiring                                     |
| `prisma/schema.prisma`                       | `refresh_token`, `refresh_token_expires_at`      |

---

## 12. Summary in one paragraph

`cookie-parser` reads incoming cookies. On login/register/refresh, auth logic
signs two JWTs, stores the refresh token (and its expiry) in the DB, and returns
declarative cookie directives that the controller turns into `Set-Cookie`
headers. `HttpOnly` + `Secure` + `SameSite=Lax` + `Path=/` protect those cookies,
and their lifetimes come from the same env values as the JWTs so nothing drifts.
Every request carries the access cookie, which `authenticate` verifies and turns
into `ctx.user`. When it expires, the refresh endpoint validates the refresh
cookie against the DB, rotates it, and issues a new pair. Logout nulls the DB
token and clears both cookies. That's the whole system.

Next: [`cookies-production-ready.md`](./cookies-production-ready.md) for every
cookie feature plus a hardened production configuration.

# Controller Guide

How the `controller()` adapter works in this project, and every possible way an
endpoint can feed it input (`body`, `query`, `params`, `cookies`, `user`).

## 1. Project at a glance

This is an **Express 5 + TypeScript + Prisma 7** API using a layered architecture:

```
request
  → app.ts            (global middleware: cors, cookieParser, json/urlencoded)
  → routes/index.ts   ("/api/v1" + "/auth")
  → module route      (auth.routes.ts: validate + authenticate + controller)
  → controller()      (infra/controllers/index.ts — the adapter)
  → logic handler     (auth.logic.ts — transport-agnostic business logic)
  → service           (user.service.ts — Prisma access)
  → errors → errorHandler
```

The key design idea: **logic never touches `req`/`res`**. The `controller()`
helper is a thin adapter that turns a clean function into an Express handler.

## 2. The controller adapter

`src/infra/controllers/index.ts`:

```ts
export const controller =
  <B = unknown, Q = unknown, P = Record<string, string>>(
    handler: (ctx: RequestContext<B, Q, P>) => Promise<ActionResult | void>,
    options: { status?: number } = {},
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = {
        body: req.body,
        query: req.query,
        params: req.params as Record<string, string>,
        cookies: (req.cookies ?? {}) as Record<string, string | undefined>,
        user: (req as AuthenticatedRequest).user,
      };

      const result = await handler(ctx);

      if (!result) {
        return res.status(204).send(); // void → 204
      }

      if (result.cookies?.length) {
        applyCookieDirectives(res, result.cookies);
      }

      const status = result.status ?? options.status ?? 200;

      return res
        .status(status)
        .json(generateResponse(result.data, result.message ?? "Success", result.meta));
    } catch (error) {
      return next(error); // → global errorHandler
    }
  };
```

Every handler receives **one object** with five things:

| Field     | Source        | Notes                                              |
| --------- | ------------- | -------------------------------------------------- |
| `body`    | `req.body`    | JSON / urlencoded                                  |
| `query`   | `req.query`   | string values unless coerced by Zod               |
| `params`  | `req.params`  | always `Record<string, string>` from the URL       |
| `cookies` | `req.cookies` | from `cookie-parser`                               |
| `user`    | `req.user`    | set by `authenticate` / `optionalAuthenticate`     |

And returns an `ActionResult`:

```ts
{ data, message?, meta?, status?, cookies? }
```

- `data` → wrapped by `generateResponse` into `{ success, message, data, meta? }`
- `status` → defaults to 200 (or `options.status` passed to `controller`)
- `cookies` → declarative `{ action: "set" | "clear", name, value, options }[]`
- returning `undefined` / `void` → `204 No Content`

The three generics `<B, Q, P>` are **purely compile-time typing** for `body`,
`query`, `params`. They do **no runtime validation** — that is a separate
middleware (`validate`).

## 3. The `validate` middleware

`src/infra/middleware/validate.ts` validates **one target at a time** and writes
the parsed result back:

```ts
validate(schema, "body");   // req.body = parsed
validate(schema, "query");  // replaces req.query via defineProperty (Express 5 query is a getter)
validate(schema, "params"); // req.params = parsed
```

You can chain several to validate multiple parts of one route. Note: `query`
values arrive as **strings**, so use `z.coerce.number()` for pagination (see
`commonSchema`).

## 4. Every way the controller can work

In all examples, the handler type mirrors the route's input sources.

### A. No input (just `user` / `cookies`, or nothing)

```ts
// GET /me  → uses ctx.user
router.get("/me", authenticate, controller(currentUser));

export async function currentUser(ctx: RequestContext): Promise<ActionResult> {
  return { data: { user: ctx.user }, message: "Current user" };
}
```

```ts
// POST /logout → uses cookies, returns 200 + clear-cookie directives
router.post("/logout", controller(logout));
```

```ts
// POST /refresh → cookies only
router.post("/refresh", controller(refreshAccessToken));
```

Return void for a pure 204 action:

```ts
router.delete("/session", controller(async () => {
  /* ... */
}));
```

### B. Body only

```ts
router.post("/register", validate(userRegistrationSchema, "body"), controller(userRegister));

export async function userRegister(
  ctx: RequestContext<UserRegisterBody>, // <B> only
): Promise<ActionResult> {
  const body = ctx.body;
  // ...
}
```

### C. Query only

```ts
// GET /products?page=1&limit=10&search=shirt
router.get("/products", validate(productListQuerySchema, "query"), controller(listProducts));

// commonSchema.pagination gives coerced numbers after validation
export async function listProducts(
  ctx: RequestContext<unknown, ProductListQuery>,
): Promise<ActionResult> {
  const { page, limit } = ctx.query;
  const items = await productService.list(ctx.query);
  return { data: items, meta: { /* ... */ } };
}
```

### D. Params only

```ts
// GET /products/:id
router.get("/products/:id", validate(idParamSchema, "params"), controller(getProduct));

export async function getProduct(
  ctx: RequestContext<unknown, unknown, { id: string }>,
): Promise<ActionResult> {
  const product = await productService.findById(ctx.params.id);
  if (!product) throw new NotFoundError("Product", ctx.params.id);
  return { data: product };
}
```

### E. Body + Query

```ts
// POST /products?draft=true&notify=false
router.post(
  "/products",
  validate(productCreateSchema, "body"),
  validate(productFlagsQuerySchema, "query"),
  controller(createProduct),
);

export async function createProduct(
  ctx: RequestContext<CreateProductBody, ProductFlagsQuery>,
): Promise<ActionResult> {
  const product = await productService.create(ctx.body, ctx.query.draft);
  return { data: product, status: 201 };
}
```

### F. Body + Params

```ts
// PATCH /products/:id
router.patch(
  "/products/:id",
  validate(idParamSchema, "params"),
  validate(productUpdateSchema, "body"),
  controller(updateProduct),
);

export async function updateProduct(
  ctx: RequestContext<UpdateProductBody, unknown, { id: string }>,
): Promise<ActionResult> {
  const updated = await productService.update(ctx.params.id, ctx.body);
  return { data: updated };
}
```

### G. Query + Params

```ts
// GET /products/:id/reviews?page=1&limit=10&sort=recent
router.get(
  "/products/:id/reviews",
  validate(idParamSchema, "params"),
  validate(reviewListQuerySchema, "query"),
  controller(listProductReviews),
);

export async function listProductReviews(
  ctx: RequestContext<unknown, ReviewQuery, { id: string }>,
): Promise<ActionResult> {
  const { page, limit } = ctx.query;
  return { data: await reviewService.byProduct(ctx.params.id, ctx.query) };
}
```

### H. Body + Query + Params (all three)

```ts
// PATCH /products/:id/inventory?warehouse=dhaka&dryRun=true
router.patch(
  "/products/:id/inventory",
  validate(idParamSchema, "params"),
  validate(inventoryQuerySchema, "query"),
  validate(inventoryUpdateSchema, "body"),
  controller(updateInventory),
);

export async function updateInventory(
  ctx: RequestContext<InventoryBody, InventoryQuery, { id: string }>,
): Promise<ActionResult> {
  const { id } = ctx.params;
  const { warehouse, dryRun } = ctx.query;
  return { data: await inventoryService.update(id, warehouse, ctx.body, dryRun) };
}
```

### I. Params + `user` (ownership checks)

```ts
router.patch(
  "/users/:id",
  authenticate,
  validate(idParamSchema, "params"),
  validate(userUpdateSchema, "body"),
  controller(updateUser),
);

export async function updateUser(
  ctx: RequestContext<UpdateUserBody, unknown, { id: string }>,
): Promise<ActionResult> {
  if (ctx.user?.role !== "ADMIN" && ctx.user?.id !== ctx.params.id) {
    throw new AuthorizationError();
  }
  return { data: await userService.update(ctx.params.id, ctx.body) };
}
```

## 5. Cheat sheet

| Route input             | Generics            | `validate` targets   | Notice                             |
| ----------------------- | ------------------- | -------------------- | ---------------------------------- |
| nothing                 | `RequestContext`    | —                    | `user` / `cookies` still available |
| body                    | `<B>`               | body                 | POST/PUT/PATCH                     |
| query                   | `<unknown, Q>`      | query                | GET lists; coerce numbers          |
| params                  | `<unknown, unknown, P>` | params           | `P` defaults to `Record<string,string>` |
| body + query            | `<B, Q>`            | body, query          | rare but valid                     |
| body + params           | `<B, unknown, P>`   | params, body         | classic update                     |
| query + params          | `<unknown, Q, P>`   | params, query        | nested resources                   |
| body + query + params   | `<B, Q, P>`         | params, query, body  | full                               |
| auth user               | any                 | —                    | add `authenticate` before `controller` |
| cookies                 | `RequestContext`    | —                    | auth endpoints                     |

## 6. Gotchas to remember

1. **Types ≠ validation.** `controller<B, Q, P>` only types `ctx`. You must add
   `validate(...)` for runtime safety. This project consistently does both.
2. **`params` default type** is `Record<string, string>`, so if you omit `P` you
   still get stringly-typed params — pass an explicit shape when you care.
3. **Query is a getter in Express 5**, which is why `validate` uses
   `Object.defineProperty` for the query target. Don't mutate `req.query`
   directly.
4. **Validation order = declaration order.** Put `params` / `query` / `body`
   validators before the `controller`, in whichever order you like.
5. **Returning nothing = 204.** If you want an empty body with a status, return
   `{ data: {} }` and set `status`.
6. **Errors are automatic.** Throwing `AppError` subclasses (`NotFoundError`,
   `ConflictError`, `AuthenticationError`, `AuthorizationError`,
   `BusinessError`, `ValidationError`) is enough — the adapter forwards them to
   `errorHandler`, which maps `statusCode` / `code`.
7. **`options.status` as fallback:** `controller(handler, { status: 201 })` sets
   a default status when the handler doesn't return one.

## 7. Mental model

`controller` is just a shape-converter:

```
(body, query, params, cookies, user)
        → { data, message, meta, status, cookies }
```

The three generics let you describe exactly which of `body` / `query` / `params`
that particular endpoint uses.

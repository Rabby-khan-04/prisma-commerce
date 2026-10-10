import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest, JwtPayload } from "../auth";
import { applyCookieDirectives, type CookieDirective } from "../auth/cookies";
import { generateResponse, type PaginationMeta } from "../utils/response";

export interface RequestContext<
  B = unknown,
  Q = unknown,
  P = Record<string, string>,
> {
  body: B;
  query: Q;
  params: P;
  cookies: Record<string, string | undefined>;
  user?: JwtPayload;
}

export interface ActionResult<T = unknown> {
  data: T;
  message?: string;
  meta?: PaginationMeta;
  status?: number;
  cookies?: CookieDirective[];
}

export const controller =
  <B = unknown, Q = unknown, P = Record<string, string>>(
    handler: (ctx: RequestContext<B, Q, P>) => Promise<ActionResult | void>,
    options: { status?: number } = {},
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx: RequestContext = {
        body: req.body,
        query: req.query,
        params: req.params as Record<string, string>,
        cookies: req.cookies,
        user: (req as AuthenticatedRequest).user,
      };

      const result = await handler(ctx as RequestContext<B, Q, P>);

      if (!result) return res.status(204).send();

      if (result.cookies?.length) {
        applyCookieDirectives(res, result.cookies);
      }

      const status = result?.status ?? options.status ?? 200;

      return res
        .status(status)
        .json(
          generateResponse(
            result?.data,
            result?.message ?? "Success",
            result?.meta,
          ),
        );
    } catch (error) {
      return next(error);
    }
  };

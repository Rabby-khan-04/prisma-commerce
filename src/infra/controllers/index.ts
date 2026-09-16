import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../auth";

export const resourceController =
  (
    controller: (
      body: any,
      query: any,
      user?: AuthenticatedRequest["user"],
    ) => Promise<unknown>,
    status: number = 200,
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const result = await controller(
        authReq.body,
        authReq.query,
        authReq.user,
      );
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  };

export const resourcesController =
  (
    controller: (req: AuthenticatedRequest) => Promise<unknown>,
    status: number = 200,
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await controller(req as AuthenticatedRequest);
      return res.status(status).json(result);
    } catch (error) {
      return next(error);
    }
  };

export interface GetControllerInput<T = Record<string, any>> {
  id: number | string;
  page?: number | string;
  limit?: number | string;
  other: T;
  user?: AuthenticatedRequest["user"];
}

const parseQueryParams = (value: unknown) => {
  if (typeof value === "string") return value;

  if (Array.isArray(value) && typeof value[0] === "string") return value[0];

  return;
};

export const getController =
  (
    controller: (input: GetControllerInput) => Promise<any>,
    requiredId?: boolean,
    needString?: boolean,
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, page, limit, ...other } = req.query;

      const parsedId = parseQueryParams(id);

      if (requiredId && !parsedId) {
        throw new Error("Id is required");
      }

      const authReq = req as AuthenticatedRequest;
      const result = await controller({
        id: needString ? (parsedId ?? "") : Number(parsedId),
        page: page as string | undefined,
        limit: limit as string | undefined,
        other: other,
        user: authReq.user,
      });

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  };

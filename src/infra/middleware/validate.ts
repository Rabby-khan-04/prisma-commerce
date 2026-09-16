import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

export type ValidationTarget = "body" | "query" | "params";

export const formatZodErrors = (
  error: ZodError,
): Array<{ field: string; message: string }> => {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: error.message,
  }));
};

export const validate = <T extends z.ZodType>(
  schema: T,
  target: ValidationTarget = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const parsed = schema.parse(data);
      if (target === "query") {
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
        });
      } else {
        req[target] = parsed;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errs = formatZodErrors(error);
      }

      next(error);
    }
  };
};

export { z };

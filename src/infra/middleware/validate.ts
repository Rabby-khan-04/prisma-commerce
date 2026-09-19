import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { ValidationError } from "../errors/app-error";

export type ValidationTarget = "body" | "query" | "params";

export const formatZodErrors = (
  error: ZodError,
): Array<{ field: string; message: string }> => {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
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
        return next(new ValidationError("Validation failed", errs));
      }

      next(error);
    }
  };
};

export const commonSchema = z.object({
  uuid: z.uuid("Invalid UUID"),

  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),

  email: z.email("Invalid email address").toLowerCase().trim(),

  password: z
    .string()
    .min(8, "Password must be 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password mut contain at least one number"),

  nonEmptyString: z.string().min(1, "This field cannot be empty").trim(),

  noNegativeNumber: z.coerce.number().nonnegative("Must be zero or positive"),

  booleanString: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === true || val === "true"),

  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
    .toLowerCase(),
});

export { z };

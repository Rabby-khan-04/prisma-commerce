import type { NextFunction, Request, Response } from "express";
import { AppError, ValidationError } from "./app-error";

interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
  stack?: string;
}

function isZodError(error: unknown): error is {
  name: "ZodError";
  issues: Array<{ path: (string | number)[]; message: string }>;
} {
  return error instanceof Error && error.name === "ZodError";
}

function formatZodErrors(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
  }));
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let statusCode = 500;
  let response: ErrorResponse = {
    success: false,
    message: "Internal server error",
    code: "INTERNAL_ERROR",
  };

  if (isZodError(error)) {
    const validationError = new ValidationError(
      "Validation failed",
      formatZodErrors(error),
    );

    statusCode = validationError.statusCode;
    response = {
      success: false,
      code: validationError.code,
      message: validationError.message,
      errors: validationError.errors,
    };
  } else if (error instanceof AppError) {
    statusCode = error.statusCode;
    response = {
      success: false,
      code: error.code,
      message: error.message,
    };

    if (error instanceof ValidationError) {
      response.errors = error.errors;
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    statusCode = 400;
    response = {
      success: false,
      message: "Invalid JSON payload",
      code: "INVALID_JSON",
    };
  }

  if (process.env.NODE_ENV === "development" && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundError(
  req: Request,
  res: Response,
): Response<any, Record<string, any>> {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: "ROUTE_NOT_FOUND",
  });
}

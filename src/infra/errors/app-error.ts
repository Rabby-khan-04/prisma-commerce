export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(
    statusCode: number = 500,
    code: string = "INTERNL_ERROR",
    message: string = "Something went wrong",
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string = "Validation failed",
    errors: Array<{ field: string; message: string }>,
  ) {
    super(400, "VALIDATION_ERROR", message);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(401, "AUTHENTICATION_ERROR", message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(403, "AUTHORIZATION_ERROR", message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource", identifier?: string | number) {
    const message = identifier
      ? `${resource} with id ${identifier} not found`
      : `${resource} not found`;

    super(404, "NOT FOUND", message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(409, "CONFLICT", message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code: string = "BUSINESS_ERROR") {
    super(422, code, message);
    Object.setPrototypeOf(this, BusinessError.prototype);
  }
}

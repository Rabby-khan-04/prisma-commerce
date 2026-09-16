import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export function generateResponse<T>(
  data: T,
  message: string = "Success",
  meta?: PaginationMeta,
) {
  return {
    success: true,
    message,
    data,
    ...(meta && { meta }),
  };
}

export function created<T>(
  res: Response,
  data: T,
  message: string = "Created successfully",
): void {
  res.status(201).json(generateResponse(data, message));
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function parsePagination(query: {
  page?: string | number;
  limit: string | number;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.min(Number(query.page) || 1, 1000));
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 1));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

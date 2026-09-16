import type { Prisma } from "../../generated/prisma/client";

export function applyProductSoftDeleteFilter(
  where: Prisma.ProductWhereInput | undefined,
): Prisma.ProductWhereInput {
  if (!where) {
    return { deletedAt: null };
  }

  if ("deletedAt" in where) {
    return where;
  }

  return { ...where, deletedAt: null };
}

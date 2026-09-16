import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { applyProductSoftDeleteFilter } from "../helper/prisma.extends";
import { env } from "./env";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter }).$extends({
  query: {
    product: {
      async findMany({ args, query }) {
        args.where = applyProductSoftDeleteFilter(args.where);
        return query(args);
      },
    },
  },
});

export { prisma };

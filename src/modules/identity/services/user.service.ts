import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../config/prisma";

class UserService {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { vendor: true },
    });
  }
  async findUserByUserName(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: { vendor: true },
    });
  }
  async userCreate(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async updateRefreshToken(id: string, token: string, expireAt: Date) {
    return prisma.$executeRaw`
      UPDATE "users"
      SET "refresh_token" = ${token}, "refresh_token_expires_at" = ${expireAt}
      WHERE id = ${id}::uuid
      `;
  }
}

export const userService = new UserService();

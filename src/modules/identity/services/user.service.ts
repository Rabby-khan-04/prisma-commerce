import type { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../config/prisma";

class UserService {
  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }
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

  async findByIdentifier(identifier: string) {
    const isEmail = identifier.includes("@");

    if (isEmail) {
      return this.findUserByEmail(identifier);
    } else {
      return this.findUserByUserName(identifier);
    }
  }

  async userCreate(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async updateRefreshToken(
    id: string,
    token: string | null,
    expireAt: Date | null,
  ) {
    return prisma.$executeRaw`
      UPDATE "users"
      SET "refresh_token" = ${token}, "refresh_token_expires_at" = ${expireAt}
      WHERE id = ${id}::uuid
      `;
  }
}

export const userService = new UserService();

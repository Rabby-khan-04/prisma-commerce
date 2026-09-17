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
}

export const userService = new UserService();

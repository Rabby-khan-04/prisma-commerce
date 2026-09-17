import bcrypt from "bcryptjs";
import { ConflictError } from "../../../infra/errors/app-error";
import { generateResponse } from "../../../infra/utils/response";
import type { UserRegisterBody } from "../schemas/auth.schema";
import { userService } from "../services/user.service";

const SALT_ROUND = 12;

export async function userRegister(body: UserRegisterBody) {
  const exist = await userService.findUserByEmail(body.email);
  if (exist) {
    throw new ConflictError(`Email already exists`);
  }

  const existUserName = await userService.findUserByUserName(body.username);

  if (existUserName)
    throw new ConflictError(`Username ${body.username} already exists`);

  const hashPassword = await bcrypt.hash(body.password, SALT_ROUND);

  const user = await userService.userCreate({
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone ?? "",
    email: body.email,
    password: hashPassword,
    gender: body.gender,
    role: "CUSTOMER",
    username: body.username,
  });

  return generateResponse(SanitizedUser(user), "User created successfully");
}

function SanitizedUser(user: Record<string, unknown>) {
  const { password, ...rest } = user;

  return rest;
}

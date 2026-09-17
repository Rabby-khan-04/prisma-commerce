import type { UserRegisterBody } from "../schemas/auth.schema";

export async function userRegister(body: UserRegisterBody) {
  console.log(body);
}

function SanitizedUser(user: Record<string, unknown>) {
  const { password, ...rest } = user;

  return rest;
}

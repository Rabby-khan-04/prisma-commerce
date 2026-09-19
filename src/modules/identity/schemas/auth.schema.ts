import { z } from "../../../infra/middleware";

export const userRegistrationSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
  username: z.string().min(1, "Username is required").trim(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  email: z.email("Invalid email").toLowerCase().trim(),
  phone: z.string().max(11, "Must be a valid bangladeshi number").optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const vendorRegistrationSchema = userRegistrationSchema.extend({
  storeName: z.string().min(1, "Store name is required").trim(),
  description: z.string().optional(),
});

export type UserRegisterBody = z.infer<typeof userRegistrationSchema>;

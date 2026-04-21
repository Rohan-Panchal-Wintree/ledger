import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  merchantId: z.string().optional(),
  role: z.enum(["admin", "finance", "settlement", "viewer"]),
  isActive: z.boolean().optional(),
  biometricEnabled: z.boolean().optional()
});

export const updateUserSchema = createUserSchema.partial();

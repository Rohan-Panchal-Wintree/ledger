import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.email()
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  merchantId: z.string().optional(),
  role: z.enum(["admin", "finance", "settlement", "viewer"]),
  isActive: z.boolean().optional(),
  biometricEnabled: z.boolean().optional()
});

export const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});

export const webauthnEmailSchema = z.object({
  email: z.email()
});

export const finishWebauthnRegistrationSchema = z.object({
  email: z.email(),
  response: z.record(z.string(), z.any()),
  deviceName: z.string().min(2)
});

export const finishWebauthnLoginSchema = z.object({
  email: z.email(),
  response: z.record(z.string(), z.any())
});

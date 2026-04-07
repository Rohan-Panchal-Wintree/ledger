import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  finishWebauthnLoginSchema,
  finishWebauthnRegistrationSchema,
  refreshSchema,
  registerSchema,
  requestOtpSchema,
  verifyOtpSchema,
  webauthnEmailSchema
} from "./auth.validation.js";
import {
  finishWebauthnLogin,
  finishWebauthnRegistration,
  logout,
  refreshToken,
  registerUser,
  requestOtp,
  startWebauthnLogin,
  startWebauthnRegistration,
  verifyOtpLogin
} from "./auth.controller.js";

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false
});

const router = Router();

router.post("/register", validateRequest(registerSchema), asyncHandler(registerUser));
router.post("/request-otp", otpLimiter, validateRequest(requestOtpSchema), asyncHandler(requestOtp));
router.post("/verify-otp", otpLimiter, validateRequest(verifyOtpSchema), asyncHandler(verifyOtpLogin));
router.post("/refresh", validateRequest(refreshSchema), asyncHandler(refreshToken));
router.post("/logout", validateRequest(refreshSchema), asyncHandler(logout));
router.post("/webauthn/register/start", validateRequest(webauthnEmailSchema), asyncHandler(startWebauthnRegistration));
router.post("/webauthn/register/finish", validateRequest(finishWebauthnRegistrationSchema), asyncHandler(finishWebauthnRegistration));
router.post("/webauthn/login/start", validateRequest(webauthnEmailSchema), asyncHandler(startWebauthnLogin));
router.post("/webauthn/login/finish", validateRequest(finishWebauthnLoginSchema), asyncHandler(finishWebauthnLogin));

export default router;

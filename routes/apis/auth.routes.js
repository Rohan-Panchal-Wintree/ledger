import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	registerUser,
	requestOtp,
	verifyOtpLogin,
	refreshToken,
	logout,
} from "../../controller/auth.controller.js";

import {
	registerSchema,
	requestOtpSchema,
	verifyOtpSchema,
	refreshSchema,
} from "../../utils/Validation.js";

const router = Router();

const otpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: process.env.NODE_ENV === "test" ? 100 : 10,
	standardHeaders: true,
	legacyHeaders: false,
});

// ROUTES - START

router.post(
	"/register",
	validateRequest(registerSchema),
	asyncHandler(registerUser),
);

router.post(
	"/request-otp",
	otpLimiter,
	validateRequest(requestOtpSchema),
	asyncHandler(requestOtp),
);

router.post(
	"/verify-otp",
	otpLimiter,
	validateRequest(verifyOtpSchema),
	asyncHandler(verifyOtpLogin),
);

router.post(
	"/refresh",
	validateRequest(refreshSchema),
	asyncHandler(refreshToken),
);

router.post("/logout", validateRequest(refreshSchema), asyncHandler(logout));

// ROUTES - END

export default router;

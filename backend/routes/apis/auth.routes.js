import { Router } from "express";
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

import { csrfMiddleware } from "../../middlewares/csrf.middleware.js";
import {
	otpRequestLimiter,
	otpVerifyLimiter,
	refreshLimiter,
} from "../../utils/rateLimiters.js";
import { middlewares } from "../../middlewares/index.js";

const router = Router();

// ROUTES - START

router.post(
	"/register",
	middlewares.authMiddleware,
	middlewares.roleMiddleware(["admin"]),
	csrfMiddleware,
	validateRequest(registerSchema),
	asyncHandler(registerUser),
);

router.post(
	"/request-otp",
	otpRequestLimiter,
	validateRequest(requestOtpSchema),
	asyncHandler(requestOtp),
);

router.post(
	"/verify-otp",
	otpVerifyLimiter,
	validateRequest(verifyOtpSchema),
	asyncHandler(verifyOtpLogin),
);

router.post(
	"/refresh",
	refreshLimiter,
	csrfMiddleware,
	validateRequest(refreshSchema, "cookies"),
	asyncHandler(refreshToken),
);

router.post("/logout", csrfMiddleware, asyncHandler(logout));

// ROUTES - END

export default router;

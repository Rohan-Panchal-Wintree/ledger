import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	uploadPayments,
	listPayments,
	listUnmatchedPayments,
	updateUnmatchedPaymentRow,
	reconcilePendingPayments,
	reconcileSingleUnmatchedPayment,
} from "../../controller/payment.controller.js";

import {
	uploadPaymentSchema,
	reconcileUnmatchedPaymentsSchema,
} from "../../utils/Validation.js";
import { authenticatedWriteLimiter } from "../../utils/rateLimiters.js";

const router = Router();

router.use(middlewares.authMiddleware);

// ROUTES - START
router.get(
	"/",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(listPayments),
);

router.post(
	"/upload-paymentsheet",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance"]),
	middlewares.uploadMiddleware.fields([
		{ name: "file", maxCount: 1 },
		{ name: "files", maxCount: 10 },
	]),
	validateRequest(uploadPaymentSchema),
	asyncHandler(uploadPayments),
);

router.get(
	"/unmatched",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(listUnmatchedPayments),
);

// Update rows of the unmatched
router.put(
	"/unmatched/:id",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(updateUnmatchedPaymentRow),
);

router.post(
	"/reconcile-unmatched",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	validateRequest(reconcileUnmatchedPaymentsSchema),
	asyncHandler(reconcilePendingPayments),
);

router.post(
	"/unmatched/:id/reconcile",
	authenticatedWriteLimiter,
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(reconcileSingleUnmatchedPayment),
);

// ROUTES - END
export default router;

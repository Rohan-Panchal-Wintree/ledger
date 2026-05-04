import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	uploadPayments,
	listPayments,
	listUnmatchedPayments,
	getUnmatchedPaymentsSummary,
	reconcilePendingPayments,
} from "../../controller/payment.controller.js";

import {
	uploadPaymentSchema,
	reconcileUnmatchedPaymentsSchema,
} from "../../utils/Validation.js";

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
	middlewares.roleMiddleware(["admin", "finance"]),
	middlewares.uploadMiddleware.fields([
		{ name: "file", maxCount: 1 },
		{ name: "files", maxCount: 30 },
	]),
	validateRequest(uploadPaymentSchema),
	asyncHandler(uploadPayments),
);

router.get(
	"/unmatched",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(listUnmatchedPayments),
);

router.get(
	"/unmatched-summary",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(getUnmatchedPaymentsSummary),
);

router.post(
	"/reconcile-unmatched",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	validateRequest(reconcileUnmatchedPaymentsSchema),
	asyncHandler(reconcilePendingPayments),
);

// ROUTES - END
export default router;

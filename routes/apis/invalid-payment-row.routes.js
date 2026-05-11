import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";

import {
	listInvalidPaymentRows,
	getInvalidPaymentRow,
	updateInvalidPaymentRow,
	deleteInvalidPaymentRow,
} from "../../controller/invalid-payment-row.controller.js";

import { reconcileInvalidPaymentRow } from "../../controller/payment.controller.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin", "finance", "settlement"]));

router.get("/", asyncHandler(listInvalidPaymentRows));
router.get("/:id", asyncHandler(getInvalidPaymentRow));
router.put("/:id", asyncHandler(updateInvalidPaymentRow));
router.post("/:id/reconcile", asyncHandler(reconcileInvalidPaymentRow));
router.delete("/:id", asyncHandler(deleteInvalidPaymentRow));

export default router;

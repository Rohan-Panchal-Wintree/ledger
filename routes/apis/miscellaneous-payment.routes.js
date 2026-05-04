import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	createMiscellaneousPayment,
	deleteMiscellaneousPayment,
	getMiscellaneousPayment,
	listMiscellaneousPayments,
	updateMiscellaneousPayment,
} from "../../controller/miscellaneous-payment.controller.js";

import {
	createMiscellaneousPaymentSchema,
	updateMiscellaneousPaymentSchema,
} from "../../utils/Validation.js";

const router = Router();

router.use(middlewares.authMiddleware);

router.get(
	"/",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(listMiscellaneousPayments),
);

router.get(
	"/:id",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(getMiscellaneousPayment),
);

router.post(
	"/",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	validateRequest(createMiscellaneousPaymentSchema),
	asyncHandler(createMiscellaneousPayment),
);

router.put(
	"/:id",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	validateRequest(updateMiscellaneousPaymentSchema),
	asyncHandler(updateMiscellaneousPayment),
);

router.delete(
	"/:id",
	middlewares.roleMiddleware(["admin", "finance", "settlement"]),
	asyncHandler(deleteMiscellaneousPayment),
);

export default router;

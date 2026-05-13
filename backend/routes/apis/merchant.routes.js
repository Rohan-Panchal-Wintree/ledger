import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	listMerchants,
	createMerchant,
	updateMerchant,
	deleteMerchant,
} from "../../controller/merchant.controller.js";
import {
	createMerchantSchema,
	updateMerchantSchema,
} from "../../utils/Validation.js";

const router = Router();

// ROUTE MIDDLEWARES
router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin"]));

// ROUTES - START

router.get("/", asyncHandler(listMerchants));
router.post(
	"/",
	validateRequest(createMerchantSchema),
	asyncHandler(createMerchant),
);

router.put(
	"/:id",
	validateRequest(updateMerchantSchema),
	asyncHandler(updateMerchant),
);
router.delete("/:id", asyncHandler(deleteMerchant));

// ROUTES - END

export default router;

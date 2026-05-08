import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	getDashboardLatest,
	getDashboardByPeriod,
	getWiresheetUploads,
} from "../../controller/dashboard.controller.js";

import { dashboardPeriodSchema } from "../../utils/Validation.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(
	middlewares.roleMiddleware(["admin", "finance", "settlement", "viewer"]),
);

router.get("/latest", asyncHandler(getDashboardLatest));

router.get(
	"/",
	validateRequest(dashboardPeriodSchema),
	asyncHandler(getDashboardByPeriod),
);

router.get("/wiresheet-uploads", asyncHandler(getWiresheetUploads));

export default router;

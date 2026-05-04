import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	listAcquirers,
	createAcquirer,
	updateAcquirer,
	deleteAcquirer,
} from "../../controller/acquirer.controller.js";

import {
	createAcquirerSchema,
	updateAcquirerSchema,
} from "../../utils/Validation.js";

const router = Router();

// ROUTE MIDDLEWARES
router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin"]));

// ROUTES - START
router.get("/", asyncHandler(listAcquirers));
router.post(
	"/",
	validateRequest(createAcquirerSchema),
	asyncHandler(createAcquirer),
);
router.put(
	"/:id",
	validateRequest(updateAcquirerSchema),
	asyncHandler(updateAcquirer),
);
router.delete("/:id", asyncHandler(deleteAcquirer));
// ROUTES - END

export default router;

import { Router } from "express";

import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";
import { uploadWiresheetSchema } from "../../utils/Validation.js";
import { uploadWiresheet } from "../../controller/wiresheet.controller.js";

const router = Router();

// ROUTE MIDDLEWARES
router.use(middlewares.authMiddleware);

// ROUTES - START
router.post(
	"/upload-wiresheet",
	middlewares.roleMiddleware(["admin", "settlement"]),
	middlewares.uploadMiddleware.fields([
		{ name: "file", maxCount: 1 },
		{ name: "files", maxCount: 30 },
	]),
	validateRequest(uploadWiresheetSchema),
	asyncHandler(uploadWiresheet),
);
// ROUTES - END

export default router;

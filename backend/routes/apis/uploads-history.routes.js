import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";

import {
  listWiresheetUploads,
  listPaymentSheetUploads,
} from "../../controller/upload-history.controller.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(
  middlewares.roleMiddleware(["admin", "finance", "settlement", "viewer"]),
);

router.get("/wiresheets", asyncHandler(listWiresheetUploads));
router.get("/payment-sheets", asyncHandler(listPaymentSheetUploads));

export default router;

import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";

import {
  listWiresheetUploads,
  listPaymentSheetUploads,
  deleteSettlementUpload,
  generateSettlementDownloadLink,
} from "../../controller/upload-history.controller.js";

import { authenticatedWriteLimiter } from "../../utils/rateLimiters.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin", "finance", "settlement"]));

router.get("/wiresheets", asyncHandler(listWiresheetUploads));
router.get("/payment-sheets", asyncHandler(listPaymentSheetUploads));
router.post(
  "/:id/download",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(generateSettlementDownloadLink),
);

router.delete(
  "/:id",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance"]),
  asyncHandler(deleteSettlementUpload),
);

export default router;

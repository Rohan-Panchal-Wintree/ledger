import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { uploadMiddleware } from "../../middleware/upload.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditLogMiddleware } from "../../middleware/audit.middleware.js";
import { uploadWiresheetSchema } from "./settlement.validation.js";
import { uploadWiresheet } from "./settlement.controller.js";

const router = Router();

router.use(authMiddleware);
router.post(
  "/upload-wiresheet",
  roleMiddleware(["admin", "settlement"]),
  uploadMiddleware.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 30 }
  ]),
  validateRequest(uploadWiresheetSchema),
  auditLogMiddleware("SETTLEMENT_WIRESHEET_UPLOAD"),
  asyncHandler(uploadWiresheet)
);

export default router;

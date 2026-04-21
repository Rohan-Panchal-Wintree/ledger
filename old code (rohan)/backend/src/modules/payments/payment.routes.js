import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { uploadMiddleware } from "../../middleware/upload.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditLogMiddleware } from "../../middleware/audit.middleware.js";
import { uploadPaymentSchema } from "./payment.validation.js";
import { uploadPayments } from "./payment.controller.js";

const router = Router();

router.use(authMiddleware);
router.post(
  "/upload",
  roleMiddleware(["admin", "finance"]),
  uploadMiddleware.single("file"),
  validateRequest(uploadPaymentSchema),
  auditLogMiddleware("PAYMENT_UPLOAD"),
  asyncHandler(uploadPayments)
);

export default router;

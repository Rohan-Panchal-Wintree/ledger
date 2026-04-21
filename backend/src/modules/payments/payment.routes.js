import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { uploadMiddleware } from "../../middleware/upload.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { auditLogMiddleware } from "../../middleware/audit.middleware.js";
import {
  reconcileUnmatchedPaymentsSchema,
  uploadPaymentSchema
} from "./payment.validation.js";
import {
  getUnmatchedPaymentsSummary,
  reconcilePendingPayments,
  uploadPayments
} from "./payment.controller.js";

const router = Router();

router.use(authMiddleware);
router.get(
  "/unmatched-summary",
  roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(getUnmatchedPaymentsSummary)
);
router.post(
  "/upload",
  roleMiddleware(["admin", "finance"]),
  uploadMiddleware.single("file"),
  validateRequest(uploadPaymentSchema),
  auditLogMiddleware("PAYMENT_UPLOAD"),
  asyncHandler(uploadPayments)
);
router.post(
  "/reconcile-unmatched",
  roleMiddleware(["admin", "finance", "settlement"]),
  validateRequest(reconcileUnmatchedPaymentsSchema),
  auditLogMiddleware("PAYMENT_UNMATCHED_RECONCILE"),
  asyncHandler(reconcilePendingPayments)
);

export default router;

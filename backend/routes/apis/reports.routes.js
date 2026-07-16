import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
  getReportDates,
  exportBankReportsExcel,
  exportBankReportsPdf,
  getPaymentDayReport,
} from "../../controller/reports.controller.js";

import { reportBankSchema } from "../../utils/Validation.js";
import { enableEncryptedResponses } from "../../middlewares/encryptedResponse.middleware.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin", "finance", "settlement"]));

// Fetch Latest 5 Dates from the database
router.get("/dates", enableEncryptedResponses, asyncHandler(getReportDates));

router.get(
  "/payment-report",
  enableEncryptedResponses,
  validateRequest(reportBankSchema),
  asyncHandler(getPaymentDayReport),
);

router.get(
  "/banks/export/excel",
  validateRequest(reportBankSchema),
  asyncHandler(exportBankReportsExcel),
);

router.get(
  "/banks/export/pdf",
  validateRequest(reportBankSchema),
  asyncHandler(exportBankReportsPdf),
);

export default router;

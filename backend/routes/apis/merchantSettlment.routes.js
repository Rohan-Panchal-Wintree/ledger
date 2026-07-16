import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";
import { authenticatedWriteLimiter } from "../../utils/rateLimiters.js";

import {
  uploadMerchantFees,
  createMerchantFee,
  listMerchantFees,
  getMerchantFee,
  updateMerchantFee,
  deleteMerchantFee,
  uploadMerchantTransactions,
  listMerchantTransactions,
  generateMerchantSettlementReport,
  listMerchantSettlementReports,
  getMerchantSettlementReport,
  downloadMerchantSettlementPdf,
  downloadMerchantSettlementExcel,
  sendMerchantSettlementEmail,
} from "../../controller/merchant-settlement.controller.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(
  middlewares.roleMiddleware(["admin", "finance", "settlement", "viewer"]),
);

/*
|--------------------------------------------------------------------------
| Fee Configuration
|--------------------------------------------------------------------------
*/

router.post(
  "/fees/upload",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  middlewares.uploadMiddleware.fields([{ name: "file", maxCount: 1 }]),
  asyncHandler(uploadMerchantFees),
);

router.post(
  "/fees",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(createMerchantFee),
);

router.get("/fees", asyncHandler(listMerchantFees));
router.get("/fees/:id", asyncHandler(getMerchantFee));

router.put(
  "/fees/:id",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(updateMerchantFee),
);

router.delete(
  "/fees/:id",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance"]),
  asyncHandler(deleteMerchantFee),
);

/*
|--------------------------------------------------------------------------
| Transaction Upload
|--------------------------------------------------------------------------
*/

router.post(
  "/transactions/upload",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  middlewares.uploadMiddleware.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 10 },
  ]),
  asyncHandler(uploadMerchantTransactions),
);

router.get("/transactions", asyncHandler(listMerchantTransactions));

/*
|--------------------------------------------------------------------------
| Merchant Settlement Reports
|--------------------------------------------------------------------------
*/

router.post(
  "/reports/generate",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(generateMerchantSettlementReport),
);

router.get("/reports", asyncHandler(listMerchantSettlementReports));
router.get("/reports/:id", asyncHandler(getMerchantSettlementReport));
router.get(
  "/reports/:id/download-pdf",
  asyncHandler(downloadMerchantSettlementPdf),
);
router.get(
  "/reports/:id/download-excel",
  asyncHandler(downloadMerchantSettlementExcel),
);

router.post(
  "/reports/:id/send-email",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(sendMerchantSettlementEmail),
);

export default router;

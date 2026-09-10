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
  activateMerchantFee,
  deleteMerchantFee,
  uploadSettlementBatchTransactions,
  listMerchantTransactions,
  generateMerchantSettlementReport,
  listMerchantSettlementReports,
  getMerchantSettlementReport,
  downloadMerchantSettlementPdf,
  downloadMerchantSettlementExcel,
  sendMerchantSettlementEmail,
  sendAllSettlementEmailsForBatch,
  uploadCountryMaster,
  createCountryMaster,
  listCountryMaster,
  getCountryMaster,
  updateCountryMaster,
  deleteCountryMaster,
  listMerchantFeeChangeRequests,
  approveMerchantFeeChangeRequest,
  rejectMerchantFeeChangeRequest,
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

//Fees updation approval
router.get(
  "/fees/change-requests",
  asyncHandler(listMerchantFeeChangeRequests),
);

router.post(
  "/fees/change-requests/:id/approve",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin"]),
  asyncHandler(approveMerchantFeeChangeRequest),
);

router.post(
  "/fees/change-requests/:id/reject",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin"]),
  asyncHandler(rejectMerchantFeeChangeRequest),
);

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

router.patch(
  "/fees/:id/activate",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance"]),
  asyncHandler(activateMerchantFee),
);

// COUNTRY

router.post(
  "/countries/upload",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  middlewares.uploadMiddleware.fields([{ name: "file", maxCount: 1 }]),
  asyncHandler(uploadCountryMaster),
);

router.post(
  "/countries",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(createCountryMaster),
);

router.get("/countries", asyncHandler(listCountryMaster));

router.get("/countries/:id", asyncHandler(getCountryMaster));

router.put(
  "/countries/:id",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(updateCountryMaster),
);

router.delete(
  "/countries/:id",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance"]),
  asyncHandler(deleteCountryMaster),
);

/*
|--------------------------------------------------------------------------
| Settlement Batch Transaction Upload
|--------------------------------------------------------------------------
*/

router.post(
  "/settlement-batches/upload",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  middlewares.uploadMiddleware.fields([
    { name: "datestampFile", maxCount: 1 },
    { name: "timestampFile", maxCount: 1 },
  ]),
  asyncHandler(uploadSettlementBatchTransactions),
);

/*
|--------------------------------------------------------------------------
| Transactions
|--------------------------------------------------------------------------
*/

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

router.post(
  "/settlement-batches/:batchId/send-all-emails",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin", "finance", "settlement"]),
  asyncHandler(sendAllSettlementEmailsForBatch),
);

router.get(
  "/merchant-fees/change-requests",
  middlewares.roleMiddleware(["admin"]),
  asyncHandler(listMerchantFeeChangeRequests),
);

router.post(
  "/merchant-fees/change-requests/:id/approve",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin"]),
  asyncHandler(approveMerchantFeeChangeRequest),
);

router.post(
  "/merchant-fees/change-requests/:id/reject",
  authenticatedWriteLimiter,
  middlewares.roleMiddleware(["admin"]),
  asyncHandler(rejectMerchantFeeChangeRequest),
);
export default router;

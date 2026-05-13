import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	getReportDates,
	getBankReports,
	exportBankReportsExcel,
	exportBankReportsPdf,
	getPaymentDayReport,
} from "../../controller/reports.controller.js";

import { reportBankSchema } from "../../utils/Validation.js";

const router = Router();

router.use(middlewares.authMiddleware);
router.use(
	middlewares.roleMiddleware(["admin", "finance", "settlement", "viewer"]),
);

router.get("/dates", asyncHandler(getReportDates));

router.get(
	"/banks",
	validateRequest(reportBankSchema),
	asyncHandler(getBankReports),
);

router.get(
	"/payment-report",
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

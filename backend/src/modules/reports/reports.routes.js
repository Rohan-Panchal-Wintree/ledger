import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { exportExcelReport, exportPdfReport, getSummaryReport } from "./reports.controller.js";

const router = Router();

router.use(authMiddleware, roleMiddleware(["admin", "finance", "settlement", "viewer"]));
router.get("/summary", asyncHandler(getSummaryReport));
router.get("/export-excel", asyncHandler(exportExcelReport));
router.get("/export-pdf", asyncHandler(exportPdfReport));

export default router;

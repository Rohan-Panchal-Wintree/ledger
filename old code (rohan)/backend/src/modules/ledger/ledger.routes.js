import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ledgerQuerySchema } from "./ledger.validation.js";
import { getLedger } from "./ledger.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", validateRequest(ledgerQuerySchema, "query"), asyncHandler(getLedger));

export default router;

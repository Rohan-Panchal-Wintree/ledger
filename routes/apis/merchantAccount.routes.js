import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler } from "../../utils/ManagedVariables.js";

import {
	listMerchantAccounts,
	deleteMerchantAccount,
} from "../../controller/merchantAccount.controller.js";

const router = Router();

/**
 * 🔐 GLOBAL MIDDLEWARES
 */
router.use(middlewares.authMiddleware);

/**
 * 📥 GET /merchant-accounts
 * View all mappings (auto-created from wiresheet)
 */
router.get("/", asyncHandler(listMerchantAccounts));

/**
 * ❌ DELETE /merchant-accounts/:id (optional)
 * Only admin can delete mappings manually
 */
router.delete(
	"/:id",
	middlewares.roleMiddleware(["admin"]),
	asyncHandler(deleteMerchantAccount),
);

export default router;

import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { merchantAccountSchema } from "./merchant-account.validation.js";
import { createMerchantAccount, listMerchantAccounts, updateMerchantAccount } from "./merchant-account.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(listMerchantAccounts));
router.post("/", roleMiddleware(["admin", "finance", "settlement"]), validateRequest(merchantAccountSchema), asyncHandler(createMerchantAccount));
router.put("/:id", roleMiddleware(["admin", "finance", "settlement"]), validateRequest(merchantAccountSchema.partial()), asyncHandler(updateMerchantAccount));

export default router;

import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { merchantSchema } from "./merchant.validation.js";
import {
  createMerchant,
  deleteMerchant,
  getMerchant,
  listMerchants,
  updateMerchant
} from "./merchant.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(listMerchants));
router.get("/:id", asyncHandler(getMerchant));
router.post("/", roleMiddleware(["admin", "finance", "settlement"]), validateRequest(merchantSchema), asyncHandler(createMerchant));
router.put("/:id", roleMiddleware(["admin", "finance", "settlement"]), validateRequest(merchantSchema.partial()), asyncHandler(updateMerchant));
router.delete("/:id", roleMiddleware(["admin", "finance", "settlement"]), asyncHandler(deleteMerchant));

export default router;

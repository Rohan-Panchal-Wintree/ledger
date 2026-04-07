import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { acquirerSchema } from "./acquirer.validation.js";
import { createAcquirer, listAcquirers, updateAcquirer } from "./acquirer.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(listAcquirers));
router.post("/", roleMiddleware(["admin", "finance"]), validateRequest(acquirerSchema), asyncHandler(createAcquirer));
router.put("/:id", roleMiddleware(["admin", "finance"]), validateRequest(acquirerSchema.partial()), asyncHandler(updateAcquirer));

export default router;

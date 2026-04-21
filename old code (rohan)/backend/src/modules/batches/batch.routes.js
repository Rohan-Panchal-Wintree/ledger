import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getBatch, listBatches } from "./batch.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/", asyncHandler(listBatches));
router.get("/:id", asyncHandler(getBatch));

export default router;

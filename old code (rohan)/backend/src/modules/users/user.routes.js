import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { roleMiddleware } from "../../middleware/role.middleware.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { createUserSchema, updateUserSchema } from "./user.validation.js";
import { createUser, listUsers, updateUser } from "./user.controller.js";

const router = Router();

router.use(authMiddleware, roleMiddleware(["admin"]));
router.get("/", asyncHandler(listUsers));
router.post("/", validateRequest(createUserSchema), asyncHandler(createUser));
router.put("/:id", validateRequest(updateUserSchema), asyncHandler(updateUser));

export default router;

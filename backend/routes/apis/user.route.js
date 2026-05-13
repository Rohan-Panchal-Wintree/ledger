import { Router } from "express";
import { middlewares } from "../../middlewares/index.js";
import { asyncHandler, validateRequest } from "../../utils/ManagedVariables.js";

import {
	listUsers,
	createUser,
	updateUser,
	deleteUser,
} from "../../controller/user.controller.js";

import { createUserSchema, updateUserSchema } from "../../utils/Validation.js";

const router = Router();

// ROUTE MIDDLEWARES
router.use(middlewares.authMiddleware);
router.use(middlewares.roleMiddleware(["admin"]));

// ROUTES - START

router.get("/", asyncHandler(listUsers));
router.post("/", validateRequest(createUserSchema), asyncHandler(createUser));
router.put("/:id", validateRequest(updateUserSchema), asyncHandler(updateUser));
router.delete("/:id", asyncHandler(deleteUser));

// ROUTES - END

export default router;

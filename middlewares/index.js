import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import { uploadMiddleware } from "../middlewares/upload.middleware.js";

export const middlewares = { authMiddleware, roleMiddleware, uploadMiddleware };

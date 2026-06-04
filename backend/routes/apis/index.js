import { Router } from "express";

import authRoutes from "./auth.routes.js";
import userRoutes from "./user.route.js";
import merchantRoutes from "./merchant.routes.js";
import acquirerRoutes from "./acquirer.routes.js";
import merchantAccountRoutes from "./merchantAccount.routes.js";
import wiresheetRoutes from "./wiresheet.route.js";
import paymentRoutes from "./payment.routes.js";
import miscellaneousPaymentRoutes from "./miscellaneous-payment.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import reportsRoutes from "./reports.routes.js";
import uploadsRoutes from "./uploads-history.routes.js";
import profileRoutes from "./profile.routes.js";
import settlementUploadRoutes from "./settlement-upload.routes.js";
import { middlewares } from "../../middlewares/index.js";
import { csrfMiddleware } from "../../middlewares/csrf.middleware.js";
import { enableEncryptedResponses } from "../../middlewares/encryptedResponse.middleware.js";
import { authenticatedApiLimiter } from "../../utils/rateLimiters.js";

const router = Router();

// Public auth routes
router.use("/auth", authRoutes);

// All routes below require login + CSRF protection for write methods
router.use(middlewares.authMiddleware);
router.use(authenticatedApiLimiter);
router.use(csrfMiddleware);

router.use("/users", userRoutes);
router.use("/merchants", merchantRoutes);
router.use("/acquirers", acquirerRoutes);
router.use("/merchant-accounts", merchantAccountRoutes);
router.use("/wiresheets", enableEncryptedResponses, wiresheetRoutes);
router.use("/payments", enableEncryptedResponses, paymentRoutes);
router.use(
	"/miscellaneous-payments",
	enableEncryptedResponses,
	miscellaneousPaymentRoutes,
);
router.use("/dashboard", enableEncryptedResponses, dashboardRoutes);
router.use("/reports", reportsRoutes);
router.use("/uploads", enableEncryptedResponses, uploadsRoutes);
router.use("/profile", profileRoutes);
router.use(
	"/settlement-uploads",
	enableEncryptedResponses,
	settlementUploadRoutes,
);

export default router;

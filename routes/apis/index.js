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

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/merchants", merchantRoutes);
router.use("/acquirers", acquirerRoutes);
router.use("/merchant-accounts", merchantAccountRoutes);
router.use("/wiresheets", wiresheetRoutes);
router.use("/payments", paymentRoutes);
router.use("/miscellaneous-payments", miscellaneousPaymentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);

export default router;

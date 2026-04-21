import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import {
	errorHandler,
	notFoundHandler,
} from "./middleware/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import merchantRoutes from "./modules/merchants/merchant.routes.js";
import acquirerRoutes from "./modules/acquirers/acquirer.routes.js";
import merchantAccountRoutes from "./modules/merchantAccounts/merchant-account.routes.js";
import batchRoutes from "./modules/batches/batch.routes.js";
import settlementRoutes from "./modules/settlements/settlement.routes.js";
import paymentRoutes from "./modules/payments/payment.routes.js";
import ledgerRoutes from "./modules/ledger/ledger.routes.js";
import reportRoutes from "./modules/reports/reports.routes.js";

export const app = express();

app.use(
	cors({
		origin: env.FRONTEND_URL,
		credentials: true,
	}),
);
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
	res.json({ success: true, message: "Backend healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/acquirers", acquirerRoutes);
app.use("/api/mids", merchantAccountRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

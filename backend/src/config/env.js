import dotenv from "dotenv";

dotenv.config();

export const env = {
	NODE_ENV: process.env.NODE_ENV || "development",
	PORT: Number(process.env.PORT) || 3939,
	MONGO_URI:
		process.env.MONGO_URI || "mongodb://127.0.0.1:27017/merchant-settlement",
	REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
	JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "change-me-access-secret",
	JWT_REFRESH_SECRET:
		process.env.JWT_REFRESH_SECRET || "change-me-refresh-secret",
	JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
	JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	EMAIL_HOST: process.env.EMAIL_HOST || "smtp.example.com",
	EMAIL_PORT: Number(process.env.EMAIL_PORT) || 587,
	EMAIL_USER: process.env.EMAIL_USER || "noreply@example.com",
	EMAIL_PASS: process.env.EMAIL_PASS || "password",
	EMAIL_FROM: process.env.EMAIL_FROM || "noreply@example.com",
	EMAIL_TLS_REJECT_UNAUTHORIZED:
		process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false",
	OTP_DELIVERY_MODE: process.env.OTP_DELIVERY_MODE || "email",
	FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
	WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID || "localhost",
	WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME || "Settlement Sunshine",
	WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || "http://localhost:5173",
	MAX_FILE_SIZE_MB: Number(process.env.MAX_FILE_SIZE_MB) || 10,
};

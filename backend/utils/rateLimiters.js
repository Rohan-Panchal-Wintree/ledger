import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../dbConnection/redis.js";

const redisStore = () =>
	new RedisStore({
		sendCommand: (...args) => getRedis().sendCommand(args),
	});

export const otpRequestLimiter = rateLimit({
	store: redisStore(),
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many OTP requests. Try again later.",
	},
});

export const otpVerifyLimiter = rateLimit({
	store: redisStore(),
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many OTP verify attempts. Try again later.",
	},
});

export const refreshLimiter = rateLimit({
	store: redisStore(),
	windowMs: 10 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many refresh requests.",
	},
});

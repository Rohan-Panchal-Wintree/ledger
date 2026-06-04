import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../dbConnection/redis.js";

const redisStore = (prefix) =>
	new RedisStore({
		prefix,
		sendCommand: (...args) => getRedis().sendCommand(args),
	});

const buildMessage = (message) => ({
	success: false,
	message,
});

const createLimiter = ({ prefix, windowMs, max, message, keyGenerator }) =>
	rateLimit({
		store: redisStore(prefix),
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		keyGenerator,
		handler: (_req, res, _next, options) => {
			return res.status(options.statusCode).json(buildMessage(message));
		},
	});

const ipKey = (req) => ipKeyGenerator(req.ip);

const userOrIpKey = (req) =>
	req.user?._id?.toString() || ipKeyGenerator(req.ip);

export const otpRequestLimiter = createLimiter({
	prefix: "rl:otp-request:",
	windowMs: 15 * 60 * 1000,
	max: 5,
	message: "Too many OTP requests. Try again later.",
	keyGenerator: ipKey,
});

export const otpVerifyLimiter = createLimiter({
	prefix: "rl:otp-verify:",
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: "Too many OTP verify attempts. Try again later.",
	keyGenerator: ipKey,
});

export const refreshLimiter = createLimiter({
	prefix: "rl:refresh:",
	windowMs: 10 * 60 * 1000,
	max: 20,
	message: "Too many refresh requests.",
	keyGenerator: ipKey,
});

export const authenticatedApiLimiter = createLimiter({
	prefix: "rl:private-api:",
	windowMs: 60 * 1000,
	max: 120,
	message: "Too many API requests. Try again shortly.",
	keyGenerator: userOrIpKey,
});

export const authenticatedWriteLimiter = createLimiter({
	prefix: "rl:private-write:",
	windowMs: 5 * 60 * 1000,
	max: 40,
	message: "Too many write requests. Try again shortly.",
	keyGenerator: userOrIpKey,
});

export const reportExportLimiter = createLimiter({
	prefix: "rl:report-export:",
	windowMs: 10 * 60 * 1000,
	max: 10,
	message: "Too many export requests. Try again later.",
	keyGenerator: userOrIpKey,
});

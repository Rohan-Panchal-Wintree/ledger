import crypto from "node:crypto";
import { getRedis } from "../dbConnection/redis.js";

const OTP_PREFIX = "ledger:otp:";
const OTP_ATTEMPT_PREFIX = "ledger:otp:attempts:";
const OTP_TTL_SECONDS = 5 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

const getOtpKey = (email) => `${OTP_PREFIX}${email.toLowerCase()}`;
const getAttemptKey = (email) => `${OTP_ATTEMPT_PREFIX}${email.toLowerCase()}`;

export const createOtp = async (email) => {
	const otp = String(crypto.randomInt(100000, 1000000));
	const redis = getRedis();

	await redis.setEx(getOtpKey(email), OTP_TTL_SECONDS, otp);
	await redis.del(getAttemptKey(email));

	return otp;
};

export const verifyOtp = async (email, otp) => {
	const redis = getRedis();
	const otpKey = getOtpKey(email);
	const attemptKey = getAttemptKey(email);

	const attempts = await redis.incr(attemptKey);
	if (attempts === 1) {
		await redis.expire(attemptKey, OTP_TTL_SECONDS);
	}

	if (attempts > MAX_VERIFY_ATTEMPTS) {
		await redis.del(otpKey);
		return false;
	}

	const savedOtp = await redis.get(otpKey);

	if (!savedOtp || savedOtp !== otp) {
		return false;
	}

	await redis.del(otpKey);
	await redis.del(attemptKey);
	return true;
};

import crypto from "crypto";
import { redisClient } from "../config/redis.js";
import { ApiError } from "../utils/ApiError.js";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_ATTEMPT_LIMIT = 5;

const otpKey = (email) => `otp:${email}`;
const otpAttemptsKey = (email) => `otp_attempts:${email}`;

export const createOtp = async (email) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  await redisClient.set(otpKey(email), otp, "EX", OTP_TTL_SECONDS);
  await redisClient.del(otpAttemptsKey(email));
  return otp;
};

export const verifyOtp = async (email, otp) => {
  const attempts = Number((await redisClient.get(otpAttemptsKey(email))) || 0);

  if (attempts >= OTP_ATTEMPT_LIMIT) {
    throw new ApiError(429, "Maximum OTP attempts exceeded");
  }

  const savedOtp = await redisClient.get(otpKey(email));
  if (!savedOtp) {
    throw new ApiError(400, "OTP expired or not requested");
  }

  if (savedOtp !== otp) {
    await redisClient.multi().incr(otpAttemptsKey(email)).expire(otpAttemptsKey(email), OTP_TTL_SECONDS).exec();
    throw new ApiError(400, "Invalid OTP");
  }

  await redisClient.del(otpKey(email), otpAttemptsKey(email));
};

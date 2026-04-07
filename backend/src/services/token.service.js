import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redisClient } from "../config/redis.js";

const refreshTokenKey = (tokenId) => `refresh:${tokenId}`;

export const createAccessToken = (user) =>
  jwt.sign({ role: user.role, email: user.email }, env.JWT_ACCESS_SECRET, {
    subject: user._id.toString(),
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  });

export const createRefreshToken = async (user) => {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign({ type: "refresh", tokenId }, env.JWT_REFRESH_SECRET, {
    subject: user._id.toString(),
    expiresIn: env.JWT_REFRESH_EXPIRES_IN
  });

  await redisClient.set(
    refreshTokenKey(tokenId),
    JSON.stringify({ userId: user._id.toString(), email: user.email }),
    "EX",
    7 * 24 * 60 * 60
  );

  return token;
};

export const rotateRefreshToken = async (refreshToken) => {
  const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  const stored = await redisClient.get(refreshTokenKey(payload.tokenId));

  if (!stored) {
    throw new Error("Refresh token invalid");
  }

  await redisClient.del(refreshTokenKey(payload.tokenId));
  return payload.sub;
};

export const revokeRefreshToken = async (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    await redisClient.del(refreshTokenKey(payload.tokenId));
  } catch (_error) {
  }
};

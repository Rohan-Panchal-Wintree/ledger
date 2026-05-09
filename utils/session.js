import crypto, { createHash } from "node:crypto";
import { getRedis } from "../dbConnection/redis.js";

const SESSION_PREFIX = "ledger:session:";
const USER_SESSION_PREFIX = "ledger:user-sessions:";
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 604800);

const getSessionKey = (sessionId) => `${SESSION_PREFIX}${sessionId}`;
const getUserSessionKey = (userId) => `${USER_SESSION_PREFIX}${userId}`;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const createSession = async (user, req) => {
	const sessionId = crypto.randomUUID();
	const csrfToken = crypto.randomBytes(32).toString("hex");

	const sessionData = {
		sessionId,
		userId: user._id.toString(),
		email: user.email,
		role: user.role,
		isActive: user.isActive,
		csrfToken,
		userAgentHash: sha256(req.get("user-agent") || "unknown"),
		createdAt: new Date().toISOString(),
	};

	await getRedis().setEx(
		getSessionKey(sessionId),
		SESSION_TTL_SECONDS,
		JSON.stringify(sessionData),
	);

	return sessionData;
};

export const getSession = async (sessionId) => {
	if (!sessionId) return null;

	const raw = await getRedis().get(getSessionKey(sessionId));
	return raw ? JSON.parse(raw) : null;
};

export const touchSession = async (sessionId) => {
	if (!sessionId) return;
	await getRedis().expire(getSessionKey(sessionId), SESSION_TTL_SECONDS);
};

export const deleteSession = async (sessionId) => {
	if (!sessionId) return;
	await getRedis().del(getSessionKey(sessionId));
};

export const validateSession = (session, req) => {
	if (!session) return false;

	const currentUserAgentHash = sha256(req.get("user-agent") || "unknown");
	return session.userAgentHash === currentUserAgentHash;
};

export const attachSessionToUser = async (userId, sessionId) => {
	await getRedis().sAdd(getUserSessionKey(userId), sessionId);
};

export const removeSessionFromUser = async (userId, sessionId) => {
	await getRedis().sRem(getUserSessionKey(userId), sessionId);
};

export const revokeAllUserSessions = async (userId) => {
	const redis = getRedis();
	const sessionIds = await redis.sMembers(getUserSessionKey(userId));

	for (const sessionId of sessionIds) {
		await redis.del(getSessionKey(sessionId));
	}

	await redis.del(getUserSessionKey(userId));
};

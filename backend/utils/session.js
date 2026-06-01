import crypto, { createHash } from "node:crypto";
import { UAParser } from "ua-parser-js";
import { getRedis } from "../dbConnection/redis.js";

const SESSION_PREFIX = "ledger:session:";
const USER_SESSION_PREFIX = "ledger:user-sessions:";
const SESSION_META_PREFIX = "ledger:session-meta:";
const LAST_SESSION_PREFIX = "ledger:last-session:";

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 604800);
const SESSION_META_TTL_SECONDS = SESSION_TTL_SECONDS + 30 * 24 * 60 * 60;
const MAX_USER_SESSIONS = 4;

const getSessionKey = (sessionId) => `${SESSION_PREFIX}${sessionId}`;
const getUserSessionKey = (userId) => `${USER_SESSION_PREFIX}${userId}`;
const getSessionMetaKey = (sessionId) => `${SESSION_META_PREFIX}${sessionId}`;
const getLastSessionKey = (userId) => `${LAST_SESSION_PREFIX}${userId}`;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getIpAddress = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0];
  }

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    null
  );
};

const getDeviceInfo = (req) => {
  const userAgent = req.get("user-agent") || "unknown";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const browser = result.browser?.name || "Unknown Browser";
  const os = result.os?.name || "Unknown OS";
  const osVersion = result.os?.version || "";
  const deviceType = result.device?.type || "desktop";
  const vendor = result.device?.vendor || "";
  const model = result.device?.model || "";

  const deviceName =
    model ||
    vendor ||
    (deviceType === "mobile"
      ? "Mobile Device"
      : deviceType === "tablet"
        ? "Tablet"
        : os === "macOS"
          ? "Mac Device"
          : os === "Windows"
            ? "Windows Device"
            : "Desktop Device");

  const platform = osVersion ? `${os} ${osVersion}` : os;

  return {
    browser,
    os,
    osVersion,
    platform,
    deviceName,
    deviceType,
    ipAddress: getIpAddress(req),
  };
};

const saveSessionMeta = async (session) => {
  if (!session?.sessionId) return;

  await getRedis().setEx(
    getSessionMetaKey(session.sessionId),
    SESSION_META_TTL_SECONDS,
    JSON.stringify(session),
  );
};

const getSessionMeta = async (sessionId) => {
  if (!sessionId) return null;

  const raw = await getRedis().get(getSessionMetaKey(sessionId));

  return raw ? safeJsonParse(raw) : null;
};

export const createSession = async (user, req) => {
  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const sessionData = {
    sessionId,
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    csrfToken,
    userAgentHash: sha256(req.get("user-agent") || "unknown"),
    createdAt: now,
    lastActiveAt: now,
    deviceInfo: getDeviceInfo(req),
  };

  await getRedis().setEx(
    getSessionKey(sessionId),
    SESSION_TTL_SECONDS,
    JSON.stringify(sessionData),
  );

  await saveSessionMeta(sessionData);

  return sessionData;
};

export const getSession = async (sessionId) => {
  if (!sessionId) return null;

  const raw = await getRedis().get(getSessionKey(sessionId));

  return raw ? JSON.parse(raw) : null;
};

export const touchSession = async (sessionId) => {
  if (!sessionId) return;

  const session = await getSession(sessionId);

  if (!session) return;

  session.lastActiveAt = new Date().toISOString();

  await getRedis().setEx(
    getSessionKey(sessionId),
    SESSION_TTL_SECONDS,
    JSON.stringify(session),
  );

  await saveSessionMeta(session);
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

export const storeLastSession = async (
  userId,
  session,
  reason = "terminated",
) => {
  if (!userId || !session) return;

  const incomingStartedAt = session.startedAt || session.createdAt;
  const incomingLastActiveAt = session.lastActiveAt || incomingStartedAt;

  const lastSession = {
    sessionId: session.sessionId,
    userId: session.userId,
    email: session.email,
    role: session.role,

    startedAt: incomingStartedAt,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    endedAt: new Date().toISOString(),

    reason,
    deviceInfo: session.deviceInfo || null,
  };

  const redis = getRedis();
  const lastSessionKey = getLastSessionKey(userId);
  const existingRaw = await redis.get(lastSessionKey);
  const existingSession = existingRaw ? safeJsonParse(existingRaw) : null;

  if (existingSession) {
    const existingTime = new Date(
      existingSession.startedAt ||
        existingSession.createdAt ||
        existingSession.lastActiveAt ||
        0,
    ).getTime();

    const incomingTime = new Date(
      incomingStartedAt || incomingLastActiveAt || 0,
    ).getTime();

    if (!Number.isNaN(existingTime) && !Number.isNaN(incomingTime)) {
      if (incomingTime < existingTime) {
        return;
      }
    }
  }

  await redis.set(lastSessionKey, JSON.stringify(lastSession));
};

export const getLastSession = async (userId) => {
  if (!userId) return null;

  const raw = await getRedis().get(getLastSessionKey(userId));

  return raw ? safeJsonParse(raw) : null;
};

export const getUserSessions = async (userId) => {
  const redis = getRedis();
  const userSessionKey = getUserSessionKey(userId);
  const sessionIds = await redis.sMembers(userSessionKey);

  const sessions = [];

  for (const sessionId of sessionIds) {
    const session = await getSession(sessionId);

    if (!session) {
      const meta = await getSessionMeta(sessionId);

      if (meta) {
        await storeLastSession(userId, meta, "expired");
      }

      await redis.sRem(userSessionKey, sessionId);
      continue;
    }

    sessions.push(session);
  }

  return sessions.sort(
    (a, b) =>
      new Date(b.lastActiveAt || b.createdAt || 0) -
      new Date(a.lastActiveAt || a.createdAt || 0),
  );
};

export const removeSessionFromUser = async (userId, sessionId) => {
  await getRedis().sRem(getUserSessionKey(userId), sessionId);
};

// this deletes the current active user sessions
export const deleteUserSession = async (
  userId,
  sessionId,
  reason = "terminated",
) => {
  if (!userId || !sessionId) return;

  const session = await getSession(sessionId);
  const fallbackMeta = session ? null : await getSessionMeta(sessionId);

  if (session || fallbackMeta) {
    await storeLastSession(userId, session || fallbackMeta, reason);
  }

  await deleteSession(sessionId);
  await removeSessionFromUser(userId, sessionId);
};

// this cleans any previous sessions so we can see just the current active sessions only
const removePreviousSessionsFromSameBrowser = async (
  userId,
  currentSessionId,
) => {
  const currentSession = await getSession(currentSessionId);

  if (!currentSession?.userAgentHash) return;

  const sessions = await getUserSessions(userId);

  for (const session of sessions) {
    if (session.sessionId === currentSessionId) continue;

    if (session.userAgentHash === currentSession.userAgentHash) {
      await deleteUserSession(
        userId,
        session.sessionId,
        "replaced_by_new_login",
      );
    }
  }
};

export const limitUserSessions = async (userId, currentSessionId) => {
  const sessions = await getUserSessions(userId);

  if (sessions.length <= MAX_USER_SESSIONS) return;

  const removableSessions = sessions
    .filter((session) => session.sessionId !== currentSessionId)
    .sort(
      (a, b) =>
        new Date(a.lastActiveAt || a.createdAt || 0) -
        new Date(b.lastActiveAt || b.createdAt || 0),
    );

  let activeCount = sessions.length;

  for (const session of removableSessions) {
    if (activeCount <= MAX_USER_SESSIONS) break;

    await deleteUserSession(
      userId,
      session.sessionId,
      "session_limit_exceeded",
    );

    activeCount -= 1;
  }
};

export const attachSessionToUser = async (userId, sessionId) => {
  await getRedis().sAdd(getUserSessionKey(userId), sessionId);
  await removePreviousSessionsFromSameBrowser(userId, sessionId);
  await limitUserSessions(userId, sessionId);
};

export const revokeAllUserSessions = async (userId) => {
  const redis = getRedis();
  const sessionIds = await redis.sMembers(getUserSessionKey(userId));

  for (const sessionId of sessionIds) {
    await deleteUserSession(userId, sessionId, "revoked_all");
  }

  await redis.del(getUserSessionKey(userId));
};

import UAParser from "ua-parser-js";

export const getSessionMetaFromRequest = (req) => {
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const browser = result.browser?.name || "Unknown Browser";
  const os = result.os?.name || "Unknown OS";
  const deviceType = result.device?.type || "desktop";
  const deviceVendor = result.device?.vendor || "";
  const deviceModel = result.device?.model || "";

  const device =
    deviceModel ||
    deviceVendor ||
    (deviceType === "mobile"
      ? "Mobile Device"
      : deviceType === "tablet"
        ? "Tablet"
        : "Desktop");

  return {
    userAgent,
    browser,
    os,
    device,
    deviceType,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    lastActiveAt: new Date().toISOString(),
  };
};

const formatSessionForProfile = (session, currentSessionId) => {
  const deviceInfo = session.deviceInfo || {};
  const isCurrentSession = session.sessionId === currentSessionId;

  const browser = deviceInfo.browser || "Unknown Browser";
  const deviceType = deviceInfo.deviceType || "desktop";

  const device =
    deviceInfo.os ||
    deviceInfo.deviceName ||
    deviceInfo.device ||
    "Unknown Device";

  return {
    sessionId: session.sessionId,
    browser,
    device,
    deviceType,
    ipAddress: deviceInfo.ipAddress || null,
    createdAt: session.createdAt,
    current: isCurrentSession,
  };
};

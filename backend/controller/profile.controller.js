import { User } from "../models/user.model.js";
import {
  deleteUserSession,
  getLastSession,
  getUserSessions,
} from "../utils/session.js";

const formatSessionForProfile = (session, currentSessionId) => {
  const deviceInfo = session.deviceInfo || {};
  const isCurrentSession = session.sessionId === currentSessionId;

  const deviceName =
    deviceInfo.deviceName ||
    deviceInfo.device ||
    (deviceInfo.deviceType === "mobile"
      ? "Mobile Device"
      : deviceInfo.deviceType === "tablet"
        ? "Tablet"
        : deviceInfo.os === "macOS"
          ? "Mac Device"
          : deviceInfo.os === "Windows"
            ? "Windows Device"
            : "Desktop Device");

  const platform =
    deviceInfo.platform ||
    [deviceInfo.os, deviceInfo.osVersion].filter(Boolean).join(" ") ||
    "Unknown OS";

  return {
    sessionId: session.sessionId,

    device: deviceName,
    deviceType: deviceInfo.deviceType || "desktop",

    browser: deviceInfo.browser || "Unknown Browser",
    os: deviceInfo.os || "Unknown OS",
    osVersion: deviceInfo.osVersion || "",
    platform,

    location: deviceInfo.ipAddress || "Unknown location",
    ipAddress: deviceInfo.ipAddress || null,

    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,

    current: isCurrentSession,
    status: isCurrentSession ? "Current session" : "Active session",
  };
};

export const getProfilePreferences = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    console.log("ProfilePreferences -> userId :", userId);

    const user = await User.findById(userId)
      .select("notificationPreferences")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      notificationPreferences: {
        pushNotifications:
          user.notificationPreferences?.pushNotifications ?? false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfilePreferences = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const { pushNotifications } = req.body;

    if (typeof pushNotifications !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "pushNotifications must be a boolean",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "notificationPreferences.pushNotifications": pushNotifications,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select("notificationPreferences")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      notificationPreferences: {
        pushNotifications:
          user.notificationPreferences?.pushNotifications ?? false,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfileSessions = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const currentSessionId = req.session.sessionId;

    const sessions = await getUserSessions(userId);
    const lastSession = await getLastSession(userId);

    const formattedSessions = sessions
      .map((session) => formatSessionForProfile(session, currentSessionId))
      .sort((a, b) => {
        if (a.current) return -1;
        if (b.current) return 1;

        return new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0);
      })
      .slice(0, 4);

    return res.status(200).json({
      success: true,
      sessions: formattedSessions,
      lastSession,
    });
  } catch (error) {
    next(error);
  }
};

export const terminateProfileSession = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const currentSessionId = req.session.sessionId;
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session id is required",
      });
    }

    if (sessionId === currentSessionId) {
      return res.status(400).json({
        success: false,
        message: "Current session cannot be terminated from here",
      });
    }

    const sessions = await getUserSessions(userId);
    const sessionBelongsToUser = sessions.some(
      (session) => session.sessionId === sessionId,
    );

    if (!sessionBelongsToUser) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    await deleteUserSession(userId, sessionId, "terminated");

    return res.status(200).json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error) {
    next(error);
  }
};

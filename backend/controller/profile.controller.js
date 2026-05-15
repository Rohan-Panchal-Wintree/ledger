import { User } from "../models/user.model.js";
import {
  deleteSession,
  getSession,
  getUserSessionIds,
  removeSessionFromUser,
} from "../utils/session.js";

export const getNotificationPreferences = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("notificationPreferences")
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      notificationPreferences: user?.notificationPreferences || {
        pushNotifications: false,
      },
    },
  });
};

export const updateNotificationPreferences = async (req, res) => {
  const { pushNotifications } = req.body;

  if (typeof pushNotifications !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "pushNotifications must be a boolean",
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        "notificationPreferences.pushNotifications": pushNotifications,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  ).select("name email role notificationPreferences");

  return res.status(200).json({
    success: true,
    message: "Notification preferences updated successfully",
    data: {
      user,
      notificationPreferences: user.notificationPreferences,
    },
  });
};

export const getActiveSessions = async (req, res) => {
  const userId = req.user._id.toString();
  const currentSessionId = req.session?.sessionId;

  const sessionIds = await getUserSessionIds(userId);

  const sessions = [];

  for (const sessionId of sessionIds) {
    const session = await getSession(sessionId);

    if (!session) {
      await removeSessionFromUser(userId, sessionId);
      continue;
    }

    if (session.userId !== userId) continue;

    sessions.push({
      sessionId: session.sessionId,
      email: session.email,
      role: session.role,
      userAgent: session.userAgent || "unknown",
      ipAddress: session.ipAddress || "unknown",
      createdAt: session.createdAt,
      lastActive: session.lastActive || session.createdAt,
      isCurrentSession: session.sessionId === currentSessionId,
    });
  }

  sessions.sort(
    (a, b) =>
      new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime(),
  );

  return res.status(200).json({
    success: true,
    data: {
      count: sessions.length,
      sessions,
    },
  });
};

export const logoutSession = async (req, res) => {
  const userId = req.user._id.toString();
  const currentSessionId = req.session?.sessionId;
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
      message: "You cannot logout the current session from this action",
    });
  }

  const session = await getSession(sessionId);

  if (!session || session.userId !== userId) {
    return res.status(404).json({
      success: false,
      message: "Session not found",
    });
  }

  await deleteSession(sessionId);
  await removeSessionFromUser(userId, sessionId);

  return res.status(200).json({
    success: true,
    message: "Session logged out successfully",
  });
};

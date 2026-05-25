import React, { useEffect, useMemo, useState } from "react";
import { User, Bell, Smartphone, Monitor, Laptop, Clock3 } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../store/slices/Auth.slice";
import ToggleSwitch from "../component/UI/ToggleSwitch";
import {
  getProfilePreferences,
  getProfileSessions,
  terminateProfileSession,
  updateProfilePreferences,
} from "../queries/profileQueries";

const getSessionIcon = (deviceType) => {
  if (deviceType === "mobile") return Smartphone;
  if (deviceType === "tablet") return Smartphone;
  if (deviceType === "desktop") return Laptop;

  return Monitor;
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} : ${hours}:${minutes}`;
};

const Profile = () => {
  const currentUser = useSelector(selectCurrentUser);

  const name = currentUser?.name || "User";
  const email = currentUser?.email || "-";
  const role = currentUser?.role || "user";

  const [pushNotifications, setPushNotifications] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [lastSession, setLastSession] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdatingPreference, setIsUpdatingPreference] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState(null);

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((item) => item[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  const lastSessionText = lastSession?.endedAt
    ? formatDateTime(lastSession.endedAt)
    : "No previous session";

  const formatNetwork = (ipAddress) => {
    if (
      !ipAddress ||
      ipAddress === "::1" ||
      ipAddress === "127.0.0.1" ||
      ipAddress === "::ffff:127.0.0.1"
    ) {
      return "Local device";
    }

    return ipAddress;
  };

  const loadProfileData = async () => {
    try {
      setIsLoadingProfile(true);

      const [preferencesResponse, sessionsResponse] = await Promise.all([
        getProfilePreferences(),
        getProfileSessions(),
      ]);

      setPushNotifications(
        preferencesResponse?.notificationPreferences?.pushNotifications ??
          false,
      );

      setSessions(sessionsResponse?.sessions || []);
      setLastSession(sessionsResponse?.lastSession || null);
    } catch (error) {
      console.error("Failed to load profile data:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleTogglePushNotifications = async () => {
    const nextValue = !pushNotifications;

    setPushNotifications(nextValue);
    setIsUpdatingPreference(true);

    try {
      const response = await updateProfilePreferences(nextValue);

      setPushNotifications(
        response?.notificationPreferences?.pushNotifications ?? nextValue,
      );
    } catch (error) {
      setPushNotifications(!nextValue);
      console.error("Failed to update notification preference:", error);
    } finally {
      setIsUpdatingPreference(false);
    }
  };

  const handleTerminateSession = async (sessionId) => {
    if (!sessionId) return;

    try {
      setTerminatingSessionId(sessionId);

      await terminateProfileSession(sessionId);

      await loadProfileData();
    } catch (error) {
      console.error("Failed to terminate session:", error);
    } finally {
      setTerminatingSessionId(null);
    }
  };

  const notifications = [
    {
      key: "pushNotifications",
      title: "Push Notifications",
      description: "Browser and device updates.",
      icon: Monitor,
    },
  ];

  return (
    <div className="w-full bg-background text-on-background">
      <main className="space-y-8">
        <section className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-extrabold text-primary">
                {initials || <User size={32} />}
              </div>

              <div className="text-center md:text-left">
                <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
                  {name}
                </h1>

                <p className="mt-2 text-sm text-on-surface-variant">{email}</p>

                <p className="mt-2 inline-flex rounded-full bg-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {role}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-surface-container-low px-5 py-4">
              <div className="flex items-center gap-3">
                <Clock3 className="text-primary" size={18} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Last Session
                  </p>
                  <p className="mt-1 text-sm font-bold text-on-surface">
                    {lastSessionText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="text-primary" size={20} />
            <h2 className="text-lg font-bold text-on-surface">
              Notification Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {notifications.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-4 rounded-lg bg-surface-container-low p-5"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                      <Icon size={18} />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-on-surface">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <ToggleSwitch
                    checked={pushNotifications}
                    onChange={handleTogglePushNotifications}
                    disabled={isUpdatingPreference || isLoadingProfile}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex items-center justify-between border-b border-outline-variant/5 px-8 py-6">
            <h3 className="text-xl font-bold tracking-tight text-on-surface">
              Active Sessions
            </h3>
          </div>

          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-container-low/50">
                <tr>
                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Browser
                  </th>

                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Device
                  </th>

                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Type
                  </th>

                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    IP / Network
                  </th>

                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Started
                  </th>

                  <th className="whitespace-nowrap px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-outline-variant/5">
                {isLoadingProfile ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-8 text-center text-sm font-medium text-on-surface-variant"
                    >
                      Loading sessions...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-8 py-8 text-center text-sm font-medium text-on-surface-variant"
                    >
                      No active sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => {
                    const Icon = getSessionIcon(session.deviceType);
                    const isTerminating =
                      terminatingSessionId === session.sessionId;

                    return (
                      <tr
                        key={session.sessionId}
                        className="group border-transparent transition-all duration-200 hover:bg-surface-container-low/45"
                      >
                        <td className="whitespace-nowrap px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                              <Icon className="text-primary" size={17} />
                            </div>

                            <span className="text-sm font-bold text-on-surface">
                              {session.browser || "Unknown Browser"}
                            </span>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
                          {session.device || "Unknown Device"}
                        </td>

                        <td className="whitespace-nowrap px-8 py-5 text-sm font-medium capitalize text-on-surface-variant">
                          {session.deviceType || "desktop"}
                        </td>

                        <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
                          {formatNetwork(session.ipAddress)}
                        </td>

                        <td className="whitespace-nowrap px-8 py-5 text-sm font-medium text-on-surface-variant">
                          {formatDateTime(session.createdAt)}
                        </td>

                        <td className="whitespace-nowrap px-8 py-5 text-right">
                          {session.current ? (
                            <span className="rounded-full bg-primary/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                              Current
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isTerminating}
                              onClick={() =>
                                handleTerminateSession(session.sessionId)
                              }
                              className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isTerminating ? "Logging out..." : "Logout"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;

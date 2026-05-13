import React, { useState } from "react";
import {
  User,
  Mail,
  Bell,
  Smartphone,
  Monitor,
  Laptop,
  Clock3,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentUser } from "../store/slices/Auth.slice";
import ToggleSwitch from "../component/UI/ToggleSwitch";

const Profile = () => {
  const currentUser = useSelector(selectCurrentUser);

  const name = currentUser?.name || "User";
  const email = currentUser?.email || "-";
  const role = currentUser?.role || "user";
  const lastSession = currentUser?.lastLogin || "2 hours ago";

  const [notificationPreferences, setNotificationPreferences] = useState({
    emailAlerts: true,
    smsNotifications: false,
    pushNotifications: true,
  });

  const handleTogglePreference = (key) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const initials = name
    .split(" ")
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const notifications = [
    {
      key: "emailAlerts",
      title: "Email Alerts",
      description: "Weekly summaries and critical alerts.",
      icon: Mail,
    },
    {
      key: "smsNotifications",
      title: "SMS Notifications",
      description: "Login activity alerts.",
      icon: Smartphone,
    },
    {
      key: "pushNotifications",
      title: "Push Notifications",
      description: "Browser and device updates.",
      icon: Monitor,
    },
  ];

  const sessions = [
    {
      device: "MacBook Pro",
      browser: "Chrome · macOS",
      location: "Current device",
      active: "Active now",
      current: true,
      icon: Laptop,
    },
    {
      device: "iPhone",
      browser: "App · iOS",
      location: "Recent login",
      active: lastSession,
      current: false,
      icon: Smartphone,
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
                    {lastSession}
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
                    checked={notificationPreferences[item.key]}
                    onChange={() => handleTogglePreference(item.key)}
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
                    Device
                  </th>
                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Location
                  </th>
                  <th className="whitespace-nowrap px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Last Active
                  </th>
                  <th className="whitespace-nowrap px-8 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-outline-variant/5">
                {sessions.map((session) => {
                  const Icon = session.icon;

                  return (
                    <tr
                      key={session.device}
                      className="group border-transparent transition-all duration-200 hover:bg-surface-container-low/45"
                    >
                      <td className="whitespace-nowrap px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8">
                            <Icon className="text-primary" size={16} />
                          </div>

                          <div className="min-w-0">
                            <span className="block truncate text-sm font-bold text-on-surface">
                              {session.device}
                            </span>
                            <span className="mt-1 block text-[11px] font-medium uppercase tracking-wide text-on-surface-variant/75">
                              {session.browser}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                        {session.location}
                      </td>

                      <td className="whitespace-nowrap px-8 py-4 text-sm font-medium text-on-surface-variant">
                        {session.active}
                      </td>

                      <td className="whitespace-nowrap px-8 py-4 text-right">
                        {session.current ? (
                          <span className="rounded-full bg-primary/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error"
                          >
                            Logout
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;

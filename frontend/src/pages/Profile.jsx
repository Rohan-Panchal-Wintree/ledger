import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bell, Clock3, Monitor, RefreshCcw, User } from "lucide-react";
import { useSelector } from "react-redux";

import DataTable from "../component/UI/DataTable";
import PageHeader from "../component/UI/PageHeader";
import Spinner from "../component/UI/Spinner";
import ToggleSwitch from "../component/UI/ToggleSwitch";
import Button from "../component/UI/Button";

import SessionRow from "../component/profile/SessionRow";

import { selectCurrentUser } from "../store/slices/Auth.slice";

import {
  useProfilePreferences,
  useProfileSessions,
  useTerminateProfileSession,
  useUpdateProfilePreferences,
} from "../queries/profileQueries";

import { getErrorMessage } from "../utils/appUtils";
import {
  formatProfileDateTime,
  profileSessionColumns,
} from "../utils/profileUtils";

const PREFERENCE_UPDATE_COOLDOWN_MS = 1500;

export default function Profile() {
  const currentUser = useSelector(selectCurrentUser);

  const preferencesQuery = useProfilePreferences();
  const sessionsQuery = useProfileSessions();
  const updatePreferencesMutation = useUpdateProfilePreferences();
  const terminateSessionMutation = useTerminateProfileSession();

  const [isPreferenceCooldown, setIsPreferenceCooldown] = useState(false);
  const preferenceCooldownTimerRef = useRef(null);

  const name = currentUser?.name || "User";
  const email = currentUser?.email || "-";
  const role = currentUser?.role || "user";

  const pushNotifications =
    preferencesQuery.data?.notificationPreferences?.pushNotifications ?? false;

  const sessions = sessionsQuery.data?.sessions || [];
  const lastSession = sessionsQuery.data?.lastSession || null;

  const isLoadingProfile =
    preferencesQuery.isLoading || sessionsQuery.isLoading;

  const initials = useMemo(() => {
    return name
      .split(" ")
      .map((item) => item[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [name]);

  const lastSessionText =
    lastSession?.startedAt || lastSession?.createdAt
      ? formatProfileDateTime(lastSession.startedAt || lastSession.createdAt)
      : "No previous session";

  useEffect(() => {
    if (preferencesQuery.error) {
      toast.error(
        getErrorMessage(
          preferencesQuery.error,
          "Failed to load profile preferences.",
        ),
      );
    }
  }, [preferencesQuery.error]);

  useEffect(() => {
    if (sessionsQuery.error) {
      toast.error(
        getErrorMessage(sessionsQuery.error, "Failed to load sessions."),
      );
    }
  }, [sessionsQuery.error]);

  useEffect(() => {
    return () => {
      if (preferenceCooldownTimerRef.current) {
        clearTimeout(preferenceCooldownTimerRef.current);
      }
    };
  }, []);

  const startPreferenceCooldown = () => {
    setIsPreferenceCooldown(true);

    if (preferenceCooldownTimerRef.current) {
      clearTimeout(preferenceCooldownTimerRef.current);
    }

    preferenceCooldownTimerRef.current = setTimeout(() => {
      setIsPreferenceCooldown(false);
    }, PREFERENCE_UPDATE_COOLDOWN_MS);
  };

  const handleTogglePushNotifications = async () => {
    if (updatePreferencesMutation.isPending || isPreferenceCooldown) return;

    try {
      await updatePreferencesMutation.mutateAsync(!pushNotifications);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Failed to update notification preference."),
      );
    } finally {
      startPreferenceCooldown();
    }
  };

  const handleTerminateSession = async (sessionId) => {
    if (!sessionId) return;

    try {
      await terminateSessionMutation.mutateAsync(sessionId);
      toast.success("Session terminated successfully.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to terminate session."));
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-surface p-4">
        <Spinner type="xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-on-background">
      <PageHeader
        title="Profile"
        description="Manage your account, notifications, and active sessions."
        className="mb-6"
      />

      <main className="space-y-8">
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8">
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

            <div className="rounded-2xl bg-surface-container-low px-5 py-4">
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

        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <div className="mb-6 flex items-center gap-3">
            <Bell className="text-primary" size={20} />

            <h2 className="text-lg font-bold text-on-surface">
              Notification Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-surface-container-low p-5">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                  <Monitor size={18} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-on-surface">
                    Push Notifications
                  </h3>

                  <p className="mt-1 text-xs text-on-surface-variant">
                    Browser and device updates.
                  </p>
                </div>
              </div>

              <ToggleSwitch
                checked={pushNotifications}
                onChange={handleTogglePushNotifications}
                disabled={
                  updatePreferencesMutation.isPending ||
                  preferencesQuery.isFetching ||
                  isPreferenceCooldown
                }
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-surface">
              Active Sessions Management
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Manage active logins across your devices.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCcw className="h-4 w-4" />}
            loading={sessionsQuery.isFetching}
            onClick={() => sessionsQuery.refetch()}
          >
            Refresh
          </Button>
        </div>

        <DataTable
          title="Active Sessions"
          columns={profileSessionColumns}
          totalItems={sessions.length}
          itemLabel="sessions"
          isEmpty={sessions.length === 0}
          emptyTitle="No active sessions found"
          emptyDescription="Your active login sessions will appear here."
          emptyIcon={Monitor}
          showFooter={false}
          isFetching={sessionsQuery.isFetching}
        >
          {sessions.map((session) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              onTerminate={handleTerminateSession}
              isTerminating={
                terminateSessionMutation.isPending &&
                terminateSessionMutation.variables === session.sessionId
              }
            />
          ))}
        </DataTable>
      </main>
    </div>
  );
}

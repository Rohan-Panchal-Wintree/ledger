import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { profileApi } from "../api";

export const profileQueryKeys = {
  all: ["profile"],

  preferences: () => [...profileQueryKeys.all, "preferences"],

  sessions: () => [...profileQueryKeys.all, "sessions"],
};

function extractResponseData(response, fallback) {
  return response?.data ?? fallback;
}

async function getProfilePreferencesApi() {
  const response = await profileApi.get("/preferences");

  return extractResponseData(response, {
    notificationPreferences: {
      pushNotifications: false,
    },
  });
}

async function updateProfilePreferencesApi(pushNotifications) {
  const response = await profileApi.patch("/preferences", {
    pushNotifications,
  });

  return extractResponseData(response, {});
}

async function getProfileSessionsApi() {
  const response = await profileApi.get("/sessions");

  return extractResponseData(response, {
    sessions: [],
    lastSession: null,
  });
}

async function terminateProfileSessionApi(sessionId) {
  const response = await profileApi.delete(`/sessions/${sessionId}`);

  return extractResponseData(response, {});
}

export function useProfilePreferences() {
  return useQuery({
    queryKey: profileQueryKeys.preferences(),
    queryFn: getProfilePreferencesApi,
  });
}

export function useProfileSessions() {
  return useQuery({
    queryKey: profileQueryKeys.sessions(),
    queryFn: getProfileSessionsApi,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUpdateProfilePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfilePreferencesApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: profileQueryKeys.preferences(),
      });
    },
  });
}

export function useTerminateProfileSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: terminateProfileSessionApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: profileQueryKeys.sessions(),
      });
    },
  });
}

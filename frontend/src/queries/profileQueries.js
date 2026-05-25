import { profileApi } from "../api";

export const getProfilePreferences = async () => {
  const response = await profileApi.get("/preferences");

  return response.data;
};

export const updateProfilePreferences = async (pushNotifications) => {
  const response = await profileApi.patch("/preferences", {
    pushNotifications,
  });

  return response.data;
};

export const getProfileSessions = async () => {
  const response = await profileApi.get("/sessions");

  return response.data;
};

export const terminateProfileSession = async (sessionId) => {
  const response = await profileApi.delete(`/sessions/${sessionId}`);

  return response.data;
};

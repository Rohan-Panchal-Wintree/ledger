import { decryptData } from "./cryptoUtils";

export async function resolveAccessTokenFromStorage() {
  const storedAuthUser = localStorage.getItem("pg_user");

  if (!storedAuthUser) {
    return null;
  }

  try {
    const restoredAuth = await decryptData(storedAuthUser);
    return restoredAuth?.accessToken || null;
  } catch (error) {
    localStorage.removeItem("pg_user");
    return null;
  }
}

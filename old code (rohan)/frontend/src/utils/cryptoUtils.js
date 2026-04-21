// cryptoUtils.js
const ENCRYPTION_KEY = "Q9x@T2mL7#vC5pZ!8Rk$3dH1sN6yF4bA";

async function getKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(ENCRYPTION_KEY),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(data) {
  const key = await getKey();
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = enc.encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const ctArray = new Uint8Array(ct);
  const combined = new Uint8Array(iv.length + ctArray.length);
  combined.set(iv, 0);
  combined.set(ctArray, iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64) {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0),
  );
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(pt));
}

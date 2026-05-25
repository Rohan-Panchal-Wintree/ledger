export async function decryptApiResponse(encryptedPayload, hexKey) {
  const keyBytes = hexToBytes(hexKey);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const iv = base64ToBytes(encryptedPayload.iv);
  const tag = base64ToBytes(encryptedPayload.tag);
  const encryptedData = base64ToBytes(encryptedPayload.data);

  const combined = new Uint8Array(encryptedData.length + tag.length);
  combined.set(encryptedData);
  combined.set(tag, encryptedData.length);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    combined,
  );

  const text = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(text);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

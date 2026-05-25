import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const HEX_64 = /^[0-9a-fA-F]{64}$/;

export function getEncryptionKey() {
	const keyHex = process.env.RESPONSE_ENCRYPTION_KEY;

	if (!keyHex) {
		throw new Error("Missing RESPONSE_ENCRYPTION_KEY");
	}

	if (!HEX_64.test(keyHex)) {
		throw new Error("RESPONSE_ENCRYPTION_KEY must be 64 hex characters");
	}

	const key = Buffer.from(keyHex, "hex");

	if (key.length !== 32) {
		throw new Error(
			"RESPONSE_ENCRYPTION_KEY must be 32 bytes / 64 hex characters",
		);
	}

	return key;
}

export function validateResponseEncryptionConfig() {
	getEncryptionKey();
}

export function deriveSessionResponseKey(sessionId) {
	if (!sessionId) {
		throw new Error("Missing sessionId for response key derivation");
	}

	return crypto
		.createHmac("sha256", getEncryptionKey())
		.update(`response:${sessionId}`)
		.digest();
}

export function encryptResponse(payload, key = getEncryptionKey()) {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();

	return {
		encrypted: true,
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		data: encrypted.toString("base64"),
	};
}

export function decryptResponseForTest(
	encryptedPayload,
	key = getEncryptionKey(),
) {
	const decipher = crypto.createDecipheriv(
		ALGORITHM,
		key,
		Buffer.from(encryptedPayload.iv, "base64"),
	);

	decipher.setAuthTag(Buffer.from(encryptedPayload.tag, "base64"));

	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(encryptedPayload.data, "base64")),
		decipher.final(),
	]);

	return JSON.parse(decrypted.toString("utf8"));
}

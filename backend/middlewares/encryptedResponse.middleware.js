import {
	deriveSessionResponseKey,
	encryptResponse,
} from "../utils/encryption.js";

function isAlreadyEncrypted(payload) {
	return (
		payload &&
		payload.encrypted === true &&
		typeof payload.iv === "string" &&
		typeof payload.tag === "string" &&
		typeof payload.data === "string"
	);
}

export function enableEncryptedResponses(req, res, next) {
	const originalJson = res.json.bind(res);

	res.locals.encryptResponse = true;

	if (req.session?.sessionId) {
		res.locals.responseEncryptionKey = deriveSessionResponseKey(
			req.session.sessionId,
		);
	}

	res.json = (payload) => {
		if (isAlreadyEncrypted(payload)) {
			return originalJson(payload);
		}

		return originalJson(
			encryptResponse(payload, res.locals.responseEncryptionKey),
		);
	};

	next();
}

export function sendEncrypted(res, payload, statusCode = 200) {
	return res
		.status(statusCode)
		.json(encryptResponse(payload, res.locals.responseEncryptionKey));
}

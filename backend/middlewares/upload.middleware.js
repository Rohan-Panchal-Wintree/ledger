import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import "dotenv/config";

const uploadDirectory = path.join(os.tmpdir(), "ledger-settlement-uploads");

// Ensure temp directory exists
fs.mkdirSync(uploadDirectory, {
	recursive: true,
});

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadDirectory);
	},

	filename: (_req, file, cb) => {
		const extension = path.extname(file.originalname);

		const baseName = path
			.basename(file.originalname, extension)
			.replace(/[^a-zA-Z0-9_-]/g, "_");

		const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${baseName}${extension}`;

		cb(null, uniqueName);
	},
});

const fileFilter = (_req, file, cb) => {
	const filename = String(file.originalname || "").toLowerCase();

	const mimeType = String(file.mimetype || "").toLowerCase();

	const allowed =
		mimeType.includes("sheet") ||
		mimeType.includes("excel") ||
		mimeType.includes("csv") ||
		filename.endsWith(".xlsx") ||
		filename.endsWith(".xls") ||
		filename.endsWith(".csv");

	if (!allowed) {
		return cb(new Error("Only Excel and CSV files are allowed"), false);
	}

	cb(null, true);
};

export const uploadMiddleware = multer({
	storage,

	fileFilter,

	limits: {
		fileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024,

		// Preserve your current multi-file functionality.
		// Can reduce later after testing.
		files: Number(process.env.MAX_FILES_PER_REQUEST || 10),
	},
});

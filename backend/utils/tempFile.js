import fs from "fs/promises";

export const safeDeleteTempFile = async (filePath) => {
	if (!filePath) {
		return;
	}

	try {
		await fs.unlink(filePath);
	} catch (error) {
		if (error.code !== "ENOENT") {
			console.error(
				`Failed to delete temporary file ${filePath}:`,
				error.message,
			);
		}
	}
};

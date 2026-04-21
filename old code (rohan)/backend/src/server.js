import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { logger } from "./utils/logger.js";

const start = async () => {
	await connectDatabase();
	await connectRedis();

	app.listen(env.PORT, () => {
		logger.info(`Backend running on port ${env.PORT}`);
	});
};

start().catch((error) => {
	logger.error({ error }, "Failed to start server");
	process.exit(1);
});

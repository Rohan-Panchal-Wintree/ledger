import express from "express";
import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dbconnect from "./dbConnection/dbconnection.js";
import { connectRedis } from "./dbConnection/redis.js";
import { allowedOrigins } from "./utils/ManagedVariables.js";
import { loggerMiddleware } from "./middlewares/logger.middleware.js";
import {
	errorHandler,
	notFoundHandler,
} from "./middlewares/error.middleware.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const port = process.env.PORT || 8990;

app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);
			if (
				allowedOrigins.indexOf(origin) !== -1 ||
				origin.includes("ngrok-free.app")
			) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		credentials: true,
	}),
);

app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" },
	}),
);

app.use(cookieParser());
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(loggerMiddleware);

const startServer = async () => {
	await dbconnect();
	await connectRedis();

	const { default: routes } = await import("./routes/index.js");

	app.use(routes);
	app.use(notFoundHandler);
	app.use(errorHandler);

	app.listen(port, () => {
		console.log(`App is Running on ${port}`);
	});
};

startServer();

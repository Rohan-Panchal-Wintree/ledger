import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import dbconnect from "./dbConnection/dbconnection.js";
import { allowedOrigins } from "./utils/ManagedVariables.js";
import { loggerMiddleware } from "./middlewares/logger.middleware.js";
import {
	errorHandler,
	notFoundHandler,
} from "./middlewares/error.middleware.js";
import routes from "./routes/index.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 8990;

// Middlewares
app.use(express.json());
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);
app.use(loggerMiddleware);
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
app.use(cookieParser());

app.listen(port, async () => {
	await dbconnect();
	console.log(`App is Running on ${port}`);
});

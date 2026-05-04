import { Router } from "express";
import apiRoutes from "./apis/index.js";

const router = Router();

router.use("/api/v1", apiRoutes);

export default router;

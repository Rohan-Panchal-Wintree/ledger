import { Router } from "express";
import {
  getProfilePreferences,
  getProfileSessions,
  terminateProfileSession,
  updateProfilePreferences,
} from "../../controller/profile.controller.js";

const router = Router();

router.get("/preferences", getProfilePreferences);
router.patch("/preferences", updateProfilePreferences);

router.get("/sessions", getProfileSessions);
router.delete("/sessions/:sessionId", terminateProfileSession);

export default router;

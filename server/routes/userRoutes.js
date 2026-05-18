import { Router } from "express";
import { getLeaderboard, getProfile, upsertUser } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", upsertUser);
router.get("/leaderboard/global", getLeaderboard);
router.get("/:userId/profile", requireAuth, getProfile);

export default router;

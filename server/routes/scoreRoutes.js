import express from "express";
import { getLeaderboardByRoom } from "../controllers/scoreController.js";

const router = express.Router();

router.get("/leaderboard/:roomCode", getLeaderboardByRoom);

export default router;

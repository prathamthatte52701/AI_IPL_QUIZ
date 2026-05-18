import { Router } from "express";
import { getLiveMatch, listLiveMatches, refreshLiveMatches } from "../controllers/liveMatchController.js";

const router = Router();

router.get("/matches", listLiveMatches);
router.post("/matches/refresh", refreshLiveMatches);
router.get("/matches/:matchId", getLiveMatch);

export default router;

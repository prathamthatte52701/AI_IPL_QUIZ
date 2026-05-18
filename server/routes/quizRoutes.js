import { Router } from "express";
import { previewLiveQuestion } from "../controllers/aiController.js";

const router = Router();

router.post("/live-question", previewLiveQuestion);

export default router;

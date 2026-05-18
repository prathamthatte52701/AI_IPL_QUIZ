import express from "express";
import { getRoom, healthCheck, listRooms } from "../controllers/gameController.js";

const router = express.Router();

router.get("/health", healthCheck);
router.get("/rooms", listRooms);
router.get("/rooms/:roomCode", getRoom);

export default router;

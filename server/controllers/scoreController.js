import { rooms, getLeaderboard } from "../store/gameStore.js";

export function getLeaderboardByRoom(req, res) {
  const room = rooms.get(String(req.params.roomCode || "").toUpperCase());
  if (!room) return res.status(404).json({ message: "Room not found" });
  return res.json({ roomCode: room.roomCode, leaderboard: getLeaderboard(room) });
}

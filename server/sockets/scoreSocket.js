import { getLeaderboard } from "../store/gameStore.js";

export function emitScoreUpdate(io, room, latestPoints = null) {
  io.to(room.roomCode).emit("score:update", {
    roomCode: room.roomCode,
    leaderboard: getLeaderboard(room),
    latestPoints
  });
}

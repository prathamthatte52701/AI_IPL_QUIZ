import cricketDataService from "../services/cricketDataService.js";
import { rooms, updateRoomLiveMatch } from "../store/gameStore.js";

export function registerLiveMatchBroadcast(io) {
  cricketDataService.on("matches:updated", (matches) => {
    io.emit("match:listUpdate", { matches, health: cricketDataService.getHealth() });
  });

  cricketDataService.on("match:updated", (match) => {
    for (const room of rooms.values()) {
      if (room.matchId === match.matchId) {
        updateRoomLiveMatch(room.roomCode, match);
        io.to(room.roomCode).emit("match:liveUpdate", match);
      }
    }
  });

  setInterval(async () => {
    for (const room of rooms.values()) {
      if (!["waiting", "countdown", "loading", "active", "revealing"].includes(room.status)) continue;
      const match = await cricketDataService.getFreshMatch(room.matchId);
      if (!match) continue;
      updateRoomLiveMatch(room.roomCode, match);
      io.to(room.roomCode).emit("match:liveUpdate", match);
    }
  }, Number(process.env.CRICKET_REFRESH_MS || 10000));
}

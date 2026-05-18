import cricketDataService from "../services/cricketDataService.js";
import {
  canStartGame,
  createRoom,
  joinRoom,
  markDisconnected,
  markPlayerReady,
  publicRoom,
  reconnectPlayer,
  resetRoomForReplay,
  rooms
} from "../store/gameStore.js";
import { persistRooms } from "../store/gameStore.js";
import { cleanRoomCode, validatePlayerInput } from "../utils/validators.js";
import { registerQuizEvents, sendNextQuestion } from "./quizSocket.js";
import { emitScoreUpdate } from "./scoreSocket.js";
import { getOrCreateUser } from "../services/persistentStore.js";
import { verifyToken } from "../services/authService.js";

function emitRoomUpdate(io, room) {
  io.to(room.roomCode).emit("game:playerJoined", publicRoom(room));
}

function runStartCountdown(io, room) {
  room.status = "countdown";
  persistRooms();
  let secondsLeft = 3;
  io.to(room.roomCode).emit("game:started", { roundNumber: 1, room: publicRoom(room), liveMatch: room.liveMatch });
  io.to(room.roomCode).emit("game:countdownUpdate", { secondsLeft });

  room.countdownInterval = setInterval(() => {
    secondsLeft -= 1;
    io.to(room.roomCode).emit("game:countdownUpdate", { secondsLeft });
    if (secondsLeft <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
      sendNextQuestion(io, room);
    }
  }, 1000);
}

export function registerGameSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    socket.on("match:list", (payload = {}, callback) => {
      callback?.({ ok: true, matches: cricketDataService.getAllLiveMatches(), health: cricketDataService.getHealth() });
    });

    socket.on("room:create", async (payload = {}, callback) => {
      try {
        const validation = validatePlayerInput(payload);
        if (!validation.ok) throw new Error(validation.message);

        const authenticatedUser = await verifyToken(payload.token);
        if (!authenticatedUser) throw new Error("Login required. Please sign in again.");
        await getOrCreateUser({ userId: authenticatedUser.userId, playerName: validation.playerName });
        const match = await cricketDataService.getFreshMatch(payload.matchId) || cricketDataService.getBestMatch();
        if (!match) throw new Error("No live or demo match available.");

        const playerId = `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const room = createRoom({
          playerId,
          userId: authenticatedUser.userId,
          socketId: socket.id,
          playerName: validation.playerName,
          difficulty: validation.difficulty,
          match
        });

        socket.join(room.roomCode);
        callback?.({ ok: true, playerId, room: publicRoom(room) });
        socket.emit("room:created", { playerId, room: publicRoom(room) });
        socket.emit("match:liveUpdate", match);
        emitRoomUpdate(io, room);
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        socket.emit("game:error", { message: error.message });
      }
    });

    socket.on("player:join", async (payload = {}, callback) => {
      try {
        const validation = validatePlayerInput(payload);
        if (!validation.ok) throw new Error(validation.message);

        const authenticatedUser = await verifyToken(payload.token);
        if (!authenticatedUser) throw new Error("Login required. Please sign in again.");
        await getOrCreateUser({ userId: authenticatedUser.userId, playerName: validation.playerName });
        const playerId = `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const room = joinRoom({ roomCode: payload.roomCode, playerId, userId: authenticatedUser.userId, socketId: socket.id, playerName: validation.playerName, difficulty: validation.difficulty });

        socket.join(room.roomCode);
        callback?.({ ok: true, playerId, room: publicRoom(room) });
        socket.emit("match:liveUpdate", room.liveMatch);
        emitRoomUpdate(io, room);
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        socket.emit("game:error", { message: error.message });
      }
    });

    socket.on("player:reconnect", (payload = {}, callback) => {
      const room = reconnectPlayer({ roomCode: payload.roomCode, playerId: payload.playerId, socketId: socket.id });
      if (!room) return callback?.({ ok: false, message: "Could not reconnect." });
      socket.join(room.roomCode);
      callback?.({ ok: true, room: publicRoom(room) });
      socket.emit("match:liveUpdate", room.liveMatch);
      emitRoomUpdate(io, room);
    });

    socket.on("player:ready", (payload = {}, callback) => {
      try {
        const room = markPlayerReady({ roomCode: payload.roomCode, playerId: payload.playerId });
        io.to(room.roomCode).emit("game:playerReadyUpdate", publicRoom(room));
        callback?.({ ok: true, room: publicRoom(room) });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        socket.emit("game:error", { message: error.message });
      }
    });

    socket.on("game:start", (payload = {}, callback) => {
      try {
        const room = rooms.get(cleanRoomCode(payload.roomCode));
        const start = canStartGame(room, payload.playerId);
        if (!start.ok) throw new Error(start.message);
        callback?.({ ok: true });
        runStartCountdown(io, room);
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        socket.emit("game:error", { message: error.message });
      }
    });

    socket.on("game:playAgain", async (payload = {}, callback) => {
      try {
        const room = rooms.get(cleanRoomCode(payload.roomCode));
        if (!room) throw new Error("Room not found.");
        if (room.hostPlayerId !== payload.playerId) throw new Error("Only host can reset the room.");
        const freshMatch = await cricketDataService.getFreshMatch(room.matchId);
        resetRoomForReplay(room, freshMatch);
        callback?.({ ok: true, room: publicRoom(room) });
        emitRoomUpdate(io, room);
        emitScoreUpdate(io, room);
      } catch (error) {
        callback?.({ ok: false, message: error.message });
        socket.emit("game:error", { message: error.message });
      }
    });

    registerQuizEvents(io, socket);

    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
      const room = markDisconnected(socket.id);
      if (room) emitRoomUpdate(io, room);
    });
  });
}

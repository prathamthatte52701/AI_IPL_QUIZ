import { generateRoomCode } from "../utils/generateRoomCode.js";
import { calculatePoints } from "../utils/calculatePoints.js";
import { cleanRoomCode, normalizeAnswer } from "../utils/validators.js";
import { loadPersistedRooms, savePersistedRooms } from "../services/roomPersistence.js";

export const rooms = new Map();

for (const rawRoom of loadPersistedRooms()) {
  const restoredPlayers = new Map((rawRoom.players || []).map((player) => [player.playerId, { ...player, socketId: null, connected: false }]));
  rooms.set(rawRoom.roomCode, {
    ...rawRoom,
    status: ["waiting", "ended"].includes(rawRoom.status) ? rawRoom.status : "waiting",
    currentQuestion: null,
    currentQuestionStartedAt: null,
    timerInterval: null,
    countdownInterval: null,
    players: restoredPlayers,
    answeredPlayers: new Set(),
    timeRemaining: rawRoom.questionTime
  });
}

export function persistRooms() {
  savePersistedRooms(rooms);
}

function createPlayer({ playerId, userId, socketId, playerName, difficulty, isHost = false }) {
  return {
    playerId,
    userId,
    socketId,
    playerName,
    difficulty,
    isHost,
    ready: isHost,
    connected: true,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    totalAnswers: 0,
    totalAnswerTime: 0,
    answeredCurrent: false,
    lastPoints: 0
  };
}

export function createRoom({ playerId, userId, socketId, playerName, difficulty, match }) {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) roomCode = generateRoomCode();

  const host = createPlayer({ playerId, userId, socketId, playerName, difficulty, isHost: true });
  const maxQuestions = Number(process.env.MAX_QUESTIONS || 5);
  const questionTime = Number(process.env.QUESTION_TIME_SECONDS || 15);

  const room = {
    roomCode,
    hostPlayerId: playerId,
    difficulty,
    status: "waiting",
    maxPlayers: Number(process.env.MAX_PLAYERS || 4),
    maxQuestions,
    questionTime,
    currentQuestionNumber: 0,
    currentQuestion: null,
    currentQuestionStartedAt: null,
    timeRemaining: questionTime,
    timerInterval: null,
    countdownInterval: null,
    players: new Map([[playerId, host]]),
    usedQuestions: [],
    answeredPlayers: new Set(),
    matchId: match?.matchId || null,
    liveMatch: match || null,
    createdAt: Date.now()
  };

  rooms.set(roomCode, room);
  persistRooms();
  return room;
}

export function joinRoom({ roomCode, playerId, userId, socketId, playerName, difficulty }) {
  const cleanCode = cleanRoomCode(roomCode);
  const room = rooms.get(cleanCode);

  if (!room) throw new Error("Room not found. Check the code again.");
  if (room.status !== "waiting") throw new Error("Game already started in this room.");
  if (room.players.size >= room.maxPlayers) throw new Error("Room is full. Max 4 players allowed.");

  const duplicateName = Array.from(room.players.values()).some(
    (player) => player.playerName.toLowerCase() === playerName.toLowerCase()
  );
  if (duplicateName) throw new Error("This player name is already taken in the room.");

  const player = createPlayer({ playerId, userId, socketId, playerName, difficulty, isHost: false });
  room.players.set(playerId, player);
  persistRooms();
  return room;
}

export function reconnectPlayer({ roomCode, playerId, socketId }) {
  const room = rooms.get(cleanRoomCode(roomCode));
  if (!room) return null;
  const player = room.players.get(playerId);
  if (!player) return null;
  player.socketId = socketId;
  player.connected = true;
  persistRooms();
  return room;
}

export function updateRoomLiveMatch(roomCode, liveMatch) {
  const room = rooms.get(cleanRoomCode(roomCode));
  if (!room) return null;
  room.liveMatch = liveMatch;
  room.matchId = liveMatch?.matchId || room.matchId;
  persistRooms();
  return room;
}

export function markPlayerReady({ roomCode, playerId }) {
  const room = rooms.get(cleanRoomCode(roomCode));
  if (!room) throw new Error("Room not found.");
  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not found.");
  player.ready = !player.ready;
  if (player.isHost) player.ready = true;
  persistRooms();
  return room;
}

export function canStartGame(room, playerId) {
  if (!room) return { ok: false, message: "Room not found." };
  if (room.hostPlayerId !== playerId) return { ok: false, message: "Only host can start the game." };
  if (room.players.size < 1) return { ok: false, message: "Need at least 1 player." };
  if (!room.matchId) return { ok: false, message: "Select a live match first." };

  const allReady = Array.from(room.players.values()).every((player) => player.ready || player.isHost);
  if (!allReady) return { ok: false, message: "All players must be ready first." };
  return { ok: true };
}

export function publicPlayer(player) {
  return {
    playerId: player.playerId,
    userId: player.userId,
    playerName: player.playerName,
    difficulty: player.difficulty,
    isHost: player.isHost,
    ready: player.ready,
    connected: player.connected,
    score: player.score,
    streak: player.streak,
    bestStreak: player.bestStreak,
    correctAnswers: player.correctAnswers,
    wrongAnswers: player.wrongAnswers,
    totalAnswers: player.totalAnswers,
    averageAnswerTime: player.totalAnswers ? Number((player.totalAnswerTime / player.totalAnswers).toFixed(1)) : 0
  };
}

export function publicRoom(room) {
  return {
    roomCode: room.roomCode,
    hostPlayerId: room.hostPlayerId,
    difficulty: room.difficulty,
    status: room.status,
    maxPlayers: room.maxPlayers,
    maxQuestions: room.maxQuestions,
    questionTime: room.questionTime,
    currentQuestionNumber: room.currentQuestionNumber,
    matchId: room.matchId,
    liveMatch: room.liveMatch,
    players: Array.from(room.players.values()).map(publicPlayer),
    leaderboard: getLeaderboard(room)
  };
}

export function getLeaderboard(room) {
  return Array.from(room.players.values())
    .map(publicPlayer)
    .sort((a, b) => b.score - a.score || b.streak - a.streak || a.playerName.localeCompare(b.playerName))
    .map((player, index) => ({ ...player, rank: index + 1 }));
}

export function resetForQuestion(room, question) {
  room.currentQuestion = question;
  room.currentQuestionNumber += 1;
  room.currentQuestionStartedAt = Date.now();
  room.timeRemaining = room.questionTime;
  room.answeredPlayers = new Set();
  room.liveMatch = question.matchSnapshot || room.liveMatch;
  room.matchId = question.matchId || room.matchId;

  for (const player of room.players.values()) {
    player.answeredCurrent = false;
    player.lastPoints = 0;
  }
  persistRooms();
}

export function getSafeQuestionPayload(room) {
  const q = room.currentQuestion;
  return {
    questionId: q.id,
    questionNumber: room.currentQuestionNumber,
    totalQuestions: room.maxQuestions,
    question: q.question,
    type: q.type,
    options: Array.isArray(q.options) ? q.options : [],
    category: q.category,
    context: q.context,
    difficulty: q.difficulty || room.difficulty,
    timerSeconds: room.questionTime,
    generatedAt: q.generatedAt,
    matchId: q.matchId,
    matchSnapshot: q.matchSnapshot,
    source: q.source
  };
}

export function submitAnswer({ roomCode, playerId, answer }) {
  const room = rooms.get(cleanRoomCode(roomCode));
  if (!room) throw new Error("Room not found.");
  if (room.status !== "active") throw new Error("No active question right now.");
  if (!room.currentQuestion) throw new Error("Question not ready.");

  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not found.");
  if (room.answeredPlayers.has(playerId)) throw new Error("Answer already submitted.");

  const now = Date.now();
  const secondsUsed = Math.min(room.questionTime, Number(((now - room.currentQuestionStartedAt) / 1000).toFixed(2)));
  const correct = normalizeAnswer(answer) === normalizeAnswer(room.currentQuestion.correct_answer);

  let pointsAdded = 0;
  if (correct) {
    pointsAdded = calculatePoints({ isCorrect: true, secondsUsed, difficulty: player.difficulty || room.difficulty, currentStreak: player.streak });
    player.score += pointsAdded;
    player.streak += 1;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    player.correctAnswers += 1;
  } else {
    player.streak = 0;
    player.wrongAnswers += 1;
  }

  player.totalAnswers += 1;
  player.totalAnswerTime += secondsUsed;
  player.answeredCurrent = true;
  player.lastPoints = pointsAdded;
  room.answeredPlayers.add(playerId);
  persistRooms();

  return {
    room,
    player,
    result: {
      playerId,
      playerName: player.playerName,
      isCorrect: correct,
      submittedAnswer: answer,
      secondsUsed,
      pointsAdded,
      reason: correct ? "Correct + speed bonus" : "Wrong answer"
    }
  };
}

export function markDisconnected(socketId) {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        player.connected = false;
        persistRooms();
        return room;
      }
    }
  }
  return null;
}

export function resetRoomForReplay(room, freshMatch = null) {
  room.status = "waiting";
  room.currentQuestionNumber = 0;
  room.currentQuestion = null;
  room.usedQuestions = [];
  room.answeredPlayers = new Set();
  room.timeRemaining = room.questionTime;
  if (freshMatch) {
    room.liveMatch = freshMatch;
    room.matchId = freshMatch.matchId;
  }

  for (const player of room.players.values()) {
    player.ready = player.isHost;
    player.score = 0;
    player.streak = 0;
    player.bestStreak = 0;
    player.correctAnswers = 0;
    player.wrongAnswers = 0;
    player.totalAnswers = 0;
    player.totalAnswerTime = 0;
    player.answeredCurrent = false;
    player.lastPoints = 0;
  }
  persistRooms();
  return room;
}

export function getAwards(room) {
  const players = Array.from(room.players.values());
  const leaderboard = getLeaderboard(room);
  const winner = leaderboard[0] || null;
  const bestStreak = [...players].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const mostAccurate = [...players].sort((a, b) => {
    const accA = a.totalAnswers ? a.correctAnswers / a.totalAnswers : 0;
    const accB = b.totalAnswers ? b.correctAnswers / b.totalAnswers : 0;
    return accB - accA || b.correctAnswers - a.correctAnswers;
  })[0];
  const fastest = [...players].filter((p) => p.totalAnswers > 0).sort((a, b) => a.totalAnswerTime / a.totalAnswers - b.totalAnswerTime / b.totalAnswers)[0];

  return {
    winner,
    awards: {
      bestStreak: bestStreak ? { playerName: bestStreak.playerName, value: bestStreak.bestStreak } : null,
      mostAccurate: mostAccurate ? { playerName: mostAccurate.playerName, value: mostAccurate.totalAnswers ? `${Math.round((mostAccurate.correctAnswers / mostAccurate.totalAnswers) * 100)}%` : "0%" } : null,
      fastest: fastest ? { playerName: fastest.playerName, value: `${(fastest.totalAnswerTime / fastest.totalAnswers).toFixed(1)}s avg` } : null
    }
  };
}

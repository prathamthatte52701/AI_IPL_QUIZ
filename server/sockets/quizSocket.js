import { getAwards, getSafeQuestionPayload, getLeaderboard, persistRooms, resetForQuestion, submitAnswer } from "../store/gameStore.js";
import { generateQuestion } from "../controllers/aiController.js";
import { emitScoreUpdate } from "./scoreSocket.js";
import { recordCompletedRoom } from "../services/persistentStore.js";

function clearRoomTimers(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.countdownInterval) clearInterval(room.countdownInterval);
  room.timerInterval = null;
  room.countdownInterval = null;
}

function revealAnswer(io, room) {
  if (!room || room.status !== "active") return;
  clearRoomTimers(room);
  room.status = "revealing";
  persistRooms();

  io.to(room.roomCode).emit("quiz:answerReveal", {
    questionId: room.currentQuestion.id,
    correctAnswer: room.currentQuestion.correct_answer,
    explanation: room.currentQuestion.explanation,
    leaderboard: getLeaderboard(room),
    liveMatch: room.liveMatch,
    generatedAt: room.currentQuestion.generatedAt
  });

  emitScoreUpdate(io, room);

  setTimeout(() => {
    if (room.currentQuestionNumber >= room.maxQuestions) endRound(io, room);
    else sendNextQuestion(io, room);
  }, 3500);
}

export async function sendNextQuestion(io, room) {
  clearRoomTimers(room);
  room.status = "loading";
  persistRooms();

  io.to(room.roomCode).emit("quiz:loading", {
    message: "Fetching latest match moment + Gemini is generating a fresh live IPL question...",
    questionNumber: room.currentQuestionNumber + 1,
    totalQuestions: room.maxQuestions,
    liveMatch: room.liveMatch
  });

  const question = await generateQuestion({ roomCode: room.roomCode, matchId: room.matchId, difficulty: room.difficulty });
  room.usedQuestions.push(question.question);
  resetForQuestion(room, question);
  room.status = "active";
  persistRooms();

  io.to(room.roomCode).emit("match:liveUpdate", room.liveMatch);
  io.to(room.roomCode).emit("quiz:questionReveal", getSafeQuestionPayload(room));
  emitScoreUpdate(io, room);

  room.timerInterval = setInterval(() => {
    room.timeRemaining -= 1;
    io.to(room.roomCode).emit("quiz:timerTick", { secondsLeft: room.timeRemaining });
    const allAnswered = room.answeredPlayers.size >= room.players.size;
    if (room.timeRemaining <= 0 || allAnswered) revealAnswer(io, room);
  }, 1000);
}

export function registerQuizEvents(io, socket) {
  socket.on("quiz:answerSubmit", (payload = {}, callback) => {
    try {
      const { roomCode, playerId, answer } = payload;
      const { room, result } = submitAnswer({ roomCode, playerId, answer });
      socket.emit("quiz:answerLocked", { submittedAnswer: result.submittedAnswer, secondsUsed: result.secondsUsed });
      emitScoreUpdate(io, room, { player: result.playerName, pointsAdded: result.pointsAdded, reason: result.reason });
      callback?.({ ok: true, result: { secondsUsed: result.secondsUsed, pointsAdded: result.pointsAdded } });
      if (room.answeredPlayers.size >= room.players.size) revealAnswer(io, room);
    } catch (error) {
      callback?.({ ok: false, message: error.message });
      socket.emit("game:error", { message: error.message });
    }
  });
}

export async function endRound(io, room) {
  clearRoomTimers(room);
  room.status = "ended";
  persistRooms();
  const leaderboard = getLeaderboard(room);
  const persistentResults = await recordCompletedRoom(room, leaderboard);
  io.to(room.roomCode).emit("game:roundEnd", {
    roomCode: room.roomCode,
    leaderboard,
    match: room.liveMatch,
    persistentResults,
    ...getAwards(room)
  });
}

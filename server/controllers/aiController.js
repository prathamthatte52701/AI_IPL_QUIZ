import cricketDataService from "../services/cricketDataService.js";
import { generateLiveQuestion } from "../services/questionGenerator.js";
import questionTracker from "../services/questionTracker.js";

export async function generateQuestion({ roomCode = "preview", matchId, difficulty = "medium" }) {
  const matchData = await cricketDataService.getFreshMatch(matchId);
  if (!matchData) throw new Error("No live match data available.");

  const recentQuestions = questionTracker.getRecent(roomCode);
  let question = await generateLiveQuestion({ matchData, difficulty, recentQuestions });

  // One safety retry if Gemini accidentally repeats the same fingerprint.
  if (questionTracker.isSimilar(roomCode, question.question)) {
    question = await generateLiveQuestion({ matchData: await cricketDataService.getFreshMatch(matchId), difficulty, recentQuestions });
  }

  questionTracker.remember(roomCode, question);
  return question;
}

export async function previewLiveQuestion(req, res, next) {
  try {
    const { matchId, difficulty = "medium" } = req.body || {};
    const question = await generateQuestion({ roomCode: "preview", matchId, difficulty });
    res.json({ ok: true, question, generatedAt: Date.now() });
  } catch (error) {
    next(error);
  }
}

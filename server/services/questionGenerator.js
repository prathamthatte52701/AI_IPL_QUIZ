import { GoogleGenAI } from "@google/genai";
import { buildLiveGeminiPrompt } from "../utils/geminiLivePrompt.js";

const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function cleanJsonText(text = "") {
  return String(text)
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/g, "")
    .trim();
}

function normalizeQuestion(raw, matchData, difficulty) {
  const question = {
    id: `q-${matchData.matchId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    question: String(raw.question || "What is the current batting team's score?").trim(),
    type: raw.type === "fill_blank" || raw.type === "true_false" ? raw.type : "multiple_choice",
    options: Array.isArray(raw.options) ? raw.options.map(String).slice(0, 4) : [],
    correct_answer: String(raw.correct_answer || "").trim(),
    explanation: String(raw.explanation || "This answer comes from the live match context.").trim(),
    context: String(raw.context || `LIVE - ${matchData.team1} vs ${matchData.team2}, ${matchData.battingScore.runs}/${matchData.battingScore.wickets} in ${matchData.overText} overs`).trim(),
    category: String(raw.category || "live_match_stats").trim(),
    difficulty: String(raw.difficulty || difficulty || "medium").toLowerCase(),
    generatedAt: Date.now(),
    matchId: matchData.matchId,
    matchSnapshot: publicMatchSnapshot(matchData),
    source: process.env.GEMINI_API_KEY ? "gemini-live" : "fallback-live"
  };

  if (question.type === "true_false") {
    question.options = ["True", "False"];
    if (!["True", "False"].includes(question.correct_answer)) question.correct_answer = "True";
  }

  if (question.type === "multiple_choice") {
    if (question.options.length < 4) return fallbackLiveQuestion(matchData, difficulty);
    if (!question.options.includes(question.correct_answer)) question.correct_answer = question.options[0];
  }

  return question;
}

export async function generateLiveQuestion({ matchData, difficulty = "medium", recentQuestions = [] }) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("your_")) {
    return fallbackLiveQuestion(matchData, difficulty);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = buildLiveGeminiPrompt({ matchData, difficulty, recentQuestions });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.75,
        maxOutputTokens: 700
      }
    });

    const text = cleanJsonText(response.text || "");
    const parsed = JSON.parse(text);
    return normalizeQuestion(parsed, matchData, difficulty);
  } catch (error) {
    const fallback = fallbackLiveQuestion(matchData, difficulty);
    fallback.source = "fallback-after-gemini-error";
    fallback.aiError = error.message;
    return fallback;
  }
}

function publicMatchSnapshot(matchData) {
  return {
    matchId: matchData.matchId,
    name: matchData.name,
    team1: matchData.team1,
    team2: matchData.team2,
    battingTeam: matchData.battingTeam,
    score: `${matchData.battingScore.runs}/${matchData.battingScore.wickets}`,
    overs: matchData.overText || matchData.battingScore.overs,
    runRate: matchData.runRate,
    currentBatsman: matchData.currentBatsman,
    currentBowler: matchData.currentBowler,
    lastWicket: matchData.lastWicket,
    partnership: matchData.partnership,
    fetchedAt: matchData.fetchedAt,
    source: matchData.source
  };
}

function fallbackLiveQuestion(matchData, difficulty = "medium") {
  const now = Date.now();
  const variants = [
    () => {
      const correct = `${matchData.battingScore.runs}/${matchData.battingScore.wickets}`;
      return {
        question: `What is ${matchData.battingTeam}'s current score in this live match?`,
        options: shuffle([correct, `${matchData.battingScore.runs + 8}/${matchData.battingScore.wickets}`, `${Math.max(0, matchData.battingScore.runs - 12)}/${matchData.battingScore.wickets + 1}`, `${matchData.battingScore.runs}/${Math.max(0, matchData.battingScore.wickets - 1)}`]),
        correct_answer: correct,
        explanation: `${matchData.battingTeam} are ${correct} after ${matchData.overText || matchData.battingScore.overs} overs.`,
        category: "live_match_stats"
      };
    },
    () => {
      const correct = String(matchData.currentBatsman?.strikeRate ?? 0);
      const sr = Number(correct);
      return {
        question: `What is ${matchData.currentBatsman?.name}'s current strike rate?`,
        options: shuffle([correct, String(Math.max(0, (sr - 18).toFixed(1))), String((sr + 12).toFixed(1)), String((sr + 28).toFixed(1))]),
        correct_answer: correct,
        explanation: `${matchData.currentBatsman?.name} has ${matchData.currentBatsman?.runs} runs from ${matchData.currentBatsman?.balls} balls, so the strike rate is ${correct}.`,
        category: "live_match_stats"
      };
    },
    () => {
      const correct = String(matchData.partnership?.runs ?? 0);
      const p = Number(correct);
      return {
        question: `How many runs have ${matchData.partnership?.player1} and ${matchData.partnership?.player2} added in the current partnership?`,
        options: shuffle([correct, String(Math.max(0, p - 11)), String(p + 9), String(p + 18)]),
        correct_answer: correct,
        explanation: `The current partnership is ${correct} runs from ${matchData.partnership?.balls} balls.`,
        category: "partnership"
      };
    },
    () => {
      const correct = matchData.lastWicket?.bowler || matchData.currentBowler?.name || "Current bowler";
      return {
        question: `Who took the last wicket of ${matchData.lastWicket?.batsman}?`,
        options: shuffle([correct, matchData.currentBatsman?.name || "Current batter", matchData.partnership?.player2 || "Non-striker", matchData.team2]),
        correct_answer: correct,
        explanation: `${matchData.lastWicket?.batsman} was dismissed by ${correct}.`,
        category: "recent_event"
      };
    },
    () => {
      const overs = oversToFloat(matchData.overText || matchData.battingScore.overs);
      const projected = overs ? Math.round((matchData.battingScore.runs / overs) * 20) : 0;
      return {
        question: `If ${matchData.battingTeam} continue at this run rate, what is the approximate 20-over projection?`,
        options: shuffle([String(projected), String(projected + 14), String(Math.max(0, projected - 17)), String(projected + 31)]),
        correct_answer: String(projected),
        explanation: `${matchData.battingScore.runs} runs in ${matchData.overText} overs projects to about ${projected} in 20 overs.`,
        category: "tactical_prediction"
      };
    }
  ];

  const maker = variants[Math.floor(now / 1000) % variants.length];
  const data = maker();
  return {
    id: `q-${matchData.matchId}-${now}-${Math.random().toString(16).slice(2, 8)}`,
    question: data.question,
    type: "multiple_choice",
    options: data.options,
    correct_answer: data.correct_answer,
    explanation: data.explanation,
    context: `LIVE - ${matchData.team1} vs ${matchData.team2}, ${matchData.battingScore.runs}/${matchData.battingScore.wickets} in ${matchData.overText || matchData.battingScore.overs} overs`,
    category: data.category,
    difficulty,
    generatedAt: now,
    matchId: matchData.matchId,
    matchSnapshot: publicMatchSnapshot(matchData),
    source: "fallback-live"
  };
}

function oversToFloat(overText) {
  const [o, b] = String(overText || "0.0").split(".").map(Number);
  return (o || 0) + (b || 0) / 6;
}

function shuffle(arr) {
  return [...new Set(arr.map(String))].sort(() => Math.random() - 0.5).slice(0, 4);
}

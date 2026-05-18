export function cleanPlayerName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 18);
}

export function normalizeDifficulty(difficulty) {
  const value = String(difficulty || "medium").toLowerCase();
  return ["easy", "medium", "hard"].includes(value) ? value : "medium";
}

export function cleanRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

export function validatePlayerInput({ playerName, difficulty }) {
  const safeName = cleanPlayerName(playerName);
  if (!safeName) {
    return { ok: false, message: "Player name is required." };
  }

  return {
    ok: true,
    playerName: safeName,
    difficulty: normalizeDifficulty(difficulty)
  };
}

export function normalizeAnswer(answer) {
  return String(answer || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

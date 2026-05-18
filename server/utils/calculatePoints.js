export function getDifficultyMultiplier(difficulty = "medium") {
  const value = String(difficulty).toLowerCase();
  if (value === "hard") return 1.5;
  if (value === "medium") return 1.2;
  return 1;
}

export function calculatePoints({ isCorrect, secondsUsed, difficulty, currentStreak = 0 }) {
  if (!isCorrect) return 0;

  const basePoints = 100;
  const normalizedSeconds = Math.min(Math.max(Number(secondsUsed) || 15, 0), 15);
  const speedBonus = Math.max(0, 15 - normalizedSeconds) * 5;
  const streakBonus = currentStreak >= 2 ? 10 : 0;
  const difficultyMultiplier = getDifficultyMultiplier(difficulty);

  return Math.floor((basePoints + speedBonus + streakBonus) * difficultyMultiplier);
}

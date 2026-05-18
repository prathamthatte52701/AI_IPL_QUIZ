import fs from "fs/promises";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-data.json");

const emptyData = () => ({
  users: [],
  gameResults: []
});

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(emptyData(), null, 2));
  }
}

async function readData() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      gameResults: Array.isArray(parsed.gameResults) ? parsed.gameResults : []
    };
  } catch {
    return emptyData();
  }
}

async function writeData(data) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function newUser({ userId, playerName }) {
  const now = new Date().toISOString();
  return {
    userId,
    playerName,
    totalPoints: 0,
    matchesPlayed: 0,
    wins: 0,
    bestScore: 0,
    createdAt: now,
    updatedAt: now
  };
}

export async function getOrCreateUser({ userId, playerName }) {
  const data = await readData();
  let user = data.users.find((item) => item.userId === userId);

  if (!user) {
    user = newUser({ userId, playerName });
    data.users.push(user);
  } else if (playerName && user.playerName !== playerName) {
    user.playerName = playerName;
    user.updatedAt = new Date().toISOString();
  }

  await writeData(data);
  return user;
}

export async function createAuthenticatedUser({ playerName, email, passwordHash }) {
  const data = await readData();
  const now = new Date().toISOString();
  const user = {
    ...newUser({ userId: `u-${Date.now()}-${Math.random().toString(16).slice(2)}`, playerName }),
    email,
    passwordHash,
    createdAt: now,
    updatedAt: now
  };
  data.users.push(user);
  await writeData(data);
  return user;
}

export async function findUserByEmail(email) {
  const data = await readData();
  return data.users.find((item) => item.email === email) || null;
}

export async function getUserById(userId) {
  const data = await readData();
  return data.users.find((item) => item.userId === userId) || null;
}

export async function getUserProfile(userId) {
  const data = await readData();
  const user = data.users.find((item) => item.userId === userId);
  if (!user) return null;

  const recentResults = data.gameResults
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 10);

  const allResults = data.gameResults.filter((item) => item.userId === userId);
  const totalScore = allResults.reduce((sum, item) => sum + item.score, 0);
  const totalCorrect = allResults.reduce((sum, item) => sum + item.correctAnswers, 0);
  const totalAnswers = allResults.reduce((sum, item) => sum + item.totalAnswers, 0);

  return {
    userId: user.userId,
    playerName: user.playerName,
    email: user.email || "",
    totalPoints: user.totalPoints,
    matchesPlayed: user.matchesPlayed,
    wins: user.wins,
    bestScore: user.bestScore,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    averageScore: allResults.length ? Number((totalScore / allResults.length).toFixed(1)) : 0,
    winRate: user.matchesPlayed ? Math.round((user.wins / user.matchesPlayed) * 100) : 0,
    accuracy: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
    recentResults
  };
}

export async function recordCompletedRoom(room, leaderboard = []) {
  const data = await readData();
  const winner = leaderboard[0] || null;
  const completedAt = new Date().toISOString();
  const results = [];

  for (const player of room.players.values()) {
    let user = data.users.find((item) => item.userId === player.userId);
    if (!user) {
      user = newUser({ userId: player.userId, playerName: player.playerName });
      data.users.push(user);
    }

    const rank = leaderboard.find((item) => item.playerId === player.playerId)?.rank || null;
    const pointsEarned = player.score;
    const won = winner?.playerId === player.playerId;

    user.playerName = player.playerName;
    user.totalPoints += pointsEarned;
    user.matchesPlayed += 1;
    user.wins += won ? 1 : 0;
    user.bestScore = Math.max(user.bestScore, player.score);
    user.updatedAt = completedAt;

    const result = {
      id: `result-${room.roomCode}-${player.playerId}-${Date.now()}`,
      userId: player.userId,
      roomCode: room.roomCode,
      matchId: room.matchId,
      matchName: room.liveMatch?.name || "Live IPL Match",
      score: player.score,
      pointsEarned,
      rank,
      correctAnswers: player.correctAnswers,
      totalAnswers: player.totalAnswers,
      won,
      completedAt
    };

    data.gameResults.push(result);
    results.push({
      playerId: player.playerId,
      userId: player.userId,
      pointsEarned,
      totalPoints: user.totalPoints,
      matchesPlayed: user.matchesPlayed,
      wins: user.wins,
      bestScore: user.bestScore,
      rank
    });
  }

  await writeData(data);
  return results;
}

export async function getGlobalLeaderboard(limit = 20) {
  const data = await readData();
  return data.users
    .filter((user) => user.matchesPlayed > 0)
    .sort((a, b) =>
      b.totalPoints - a.totalPoints ||
      b.wins - a.wins ||
      b.bestScore - a.bestScore ||
      a.playerName.localeCompare(b.playerName)
    )
    .slice(0, limit)
    .map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      playerName: user.playerName,
      totalPoints: user.totalPoints,
      matchesPlayed: user.matchesPlayed,
      wins: user.wins,
      bestScore: user.bestScore
    }));
}

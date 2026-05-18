import { getGlobalLeaderboard, getOrCreateUser, getUserProfile } from "../services/persistentStore.js";

export async function upsertUser(req, res, next) {
  try {
    const { userId, playerName } = req.body || {};
    if (!userId || !playerName) {
      return res.status(400).json({ ok: false, message: "userId and playerName are required." });
    }
    const user = await getOrCreateUser({ userId, playerName });
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
}

export async function getProfile(req, res, next) {
  try {
    if (req.user.userId !== req.params.userId) {
      return res.status(403).json({ ok: false, message: "You can only view your own profile." });
    }
    const profile = await getUserProfile(req.params.userId);
    if (!profile) return res.status(404).json({ ok: false, message: "User not found." });
    res.json({ ok: true, profile });
  } catch (error) {
    next(error);
  }
}

export async function getLeaderboard(req, res, next) {
  try {
    const leaderboard = await getGlobalLeaderboard();
    res.json({ ok: true, leaderboard });
  } catch (error) {
    next(error);
  }
}

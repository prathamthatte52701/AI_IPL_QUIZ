import { loginUser, registerUser } from "../services/authService.js";

function publicAuthUser(user) {
  return {
    userId: user.userId,
    playerName: user.playerName,
    email: user.email
  };
}

export async function register(req, res, next) {
  try {
    const { playerName, email, password } = req.body || {};
    if (!playerName || !email || !password) {
      return res.status(400).json({ ok: false, message: "playerName, email, and password are required." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, message: "Password must be at least 6 characters." });
    }
    const { user, token } = await registerUser({ playerName, email, password });
    res.status(201).json({ ok: true, user: publicAuthUser(user), token });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "email and password are required." });
    }
    const { user, token } = await loginUser({ email, password });
    res.json({ ok: true, user: publicAuthUser(user), token });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  res.json({
    ok: true,
    user: {
      userId: req.user.userId,
      playerName: req.user.playerName,
      email: req.user.email
    }
  });
}

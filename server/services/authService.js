import crypto from "crypto";
import { createAuthenticatedUser, findUserByEmail, getUserById } from "./persistentStore.js";

const tokenSecret = process.env.AUTH_TOKEN_SECRET || "change-this-dev-secret";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", tokenSecret).update(value).digest("base64url");
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash = "") {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createToken(user) {
  const payload = encode({
    sub: user.userId,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
  return `${payload}.${sign(payload)}`;
}

export async function verifyToken(token = "") {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp < Date.now()) return null;
    return await getUserById(parsed.sub);
  } catch {
    return null;
  }
}

export async function registerUser({ playerName, email, password }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (await findUserByEmail(normalizedEmail)) throw new Error("An account with this email already exists.");
  const user = await createAuthenticatedUser({
    playerName,
    email: normalizedEmail,
    passwordHash: hashPassword(password)
  });
  return { user, token: createToken(user) };
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(String(email || "").trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error("Invalid email or password.");
  return { user, token: createToken(user) };
}

import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const roomsFile = path.join(dataDir, "rooms.json");

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function loadPersistedRooms() {
  ensureDir();
  if (!fs.existsSync(roomsFile)) return [];
  try {
    const raw = fs.readFileSync(roomsFile, "utf8");
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function savePersistedRooms(rooms) {
  ensureDir();
  const rows = Array.from(rooms.values()).map((room) => ({
    ...room,
    timerInterval: null,
    countdownInterval: null,
    players: Array.from(room.players.values()).map((player) => ({
      ...player,
      socketId: null,
      connected: false
    })),
    answeredPlayers: Array.from(room.answeredPlayers || [])
  }));
  fs.writeFileSync(roomsFile, JSON.stringify(rows, null, 2));
}

import { rooms, publicRoom } from "../store/gameStore.js";

export function healthCheck(req, res) {
  res.json({ ok: true, message: "AI Cricket Quiz Battle API is running" });
}

export function listRooms(req, res) {
  const data = Array.from(rooms.values()).map(publicRoom);
  res.json({ count: data.length, rooms: data });
}

export function getRoom(req, res) {
  const room = rooms.get(String(req.params.roomCode || "").toUpperCase());
  if (!room) return res.status(404).json({ message: "Room not found" });
  return res.json(publicRoom(room));
}

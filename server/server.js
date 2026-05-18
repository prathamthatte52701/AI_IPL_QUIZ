import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createSocketServer } from "./config/socketio.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import gameRoutes from "./routes/gameRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import scoreRoutes from "./routes/scoreRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { registerGameSocket } from "./sockets/gameSocket.js";
import { registerLiveMatchBroadcast } from "./sockets/liveMatchSocket.js";
import cricketDataService from "./services/cricketDataService.js";

const app = express();
const server = http.createServer(app);
const io = createSocketServer(server);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(distPath));

app.get("/", (req, res) => {
  res.json({
    name: "AI Cricket Quiz Battle LIVE API",
    status: "running",
    socket: "enabled",
    ai: process.env.GEMINI_API_KEY ? "Gemini enabled" : "Fallback live questions mode",
    cricketData: cricketDataService.getHealth(),
    storage: "Live rooms in memory + persistent JSON profiles/results."
  });
});

app.use("/api", gameRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/live", matchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

cricketDataService.start();
registerGameSocket(io);
registerLiveMatchBroadcast(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Client allowed: ${CLIENT_URL}`);
  console.log("🏏 Live cricket data service started");
  console.log("💾 Storage: live rooms in memory + persistent JSON profiles/results.");
});

import { Server } from "socket.io";

export function createSocketServer(httpServer) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  return new Server(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 20000,
    pingInterval: 25000
  });
}

import { NextApiRequest } from "next";
import { Server as NetServer } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { addNote, getSnapshot, startRetro, toggleVote } from "@/lib/store";

interface SocketServer extends NetServer {
  io?: IOServer;
}

interface NextApiResponseWithSocket extends Response {
  socket: {
    server: SocketServer;
  };
}

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(req: NextApiRequest, res: any) {
  const server: SocketServer = res.socket.server as any;

  if (!server.io) {
    const io = new IOServer(server, {
      path: "/api/socket_io",
      addTrailingSlash: false,
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    server.io = io;

    io.on("connection", (socket: Socket) => {
      socket.on("join", async (payload: { retroId: string }) => {
        socket.join(payload.retroId);
        const snapshot = getSnapshot(payload.retroId);
        if (snapshot) {
          socket.emit("state", snapshot);
        }
      });

      socket.on("startRetro", (payload: { retroId: string; durationMinutes: number; starterUserId: string }) => {
        const retro = startRetro(payload.retroId, payload.durationMinutes, payload.starterUserId);
        if (retro) {
          const snapshot = getSnapshot(payload.retroId);
          if (snapshot) {
            io.to(payload.retroId).emit("state", snapshot);
          }
        }
      });

      socket.on("addNote", (payload: { retroId: string; column: "good" | "bad" | "ideas"; text: string; authorId: string; authorName?: string }) => {
        const note = addNote(payload);
        if (note) {
          const snapshot = getSnapshot(payload.retroId);
          if (snapshot) {
            socket.to(payload.retroId).emit("state", snapshot);
            socket.emit("state", snapshot);
          }
        }
      });

      socket.on("toggleVote", (payload: { retroId: string; noteId: string; userId: string }) => {
        const result = toggleVote(payload);
        const snapshot = getSnapshot(payload.retroId);
        if (snapshot) {
          if (result.ok) {
            // broadcast full state on successful vote change
            (socket as any).to(payload.retroId).emit("state", snapshot);
            socket.emit("state", snapshot);
          } else {
            socket.emit("voteError", result.reason);
          }
        }
      });
    });
  }
  res.end();
}



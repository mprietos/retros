import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;
  // ensure server-side socket is initialized
  if (typeof window !== "undefined") {
    // fire and forget
    fetch("/api/socket").catch(() => {});
  }
  socket = io("", { path: "/api/socket_io" });
  return socket;
}



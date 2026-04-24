// client/services/socket.js
import { io } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket = null;

export function connectSocket(accessToken) {
  if (socket?.connected) return socket;
  // Disconnect stale/rejected socket before creating a new one
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 5000,
  });
  // Store userId on client socket so useMatch can identify own events
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    socket.userId = payload.userId;
  } catch { /* invalid token — userId will be undefined */ }
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

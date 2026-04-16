// client/services/socket.js
import { io } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket = null;

export function connectSocket(accessToken) {
  if (socket?.connected) return socket;
  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
  });
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

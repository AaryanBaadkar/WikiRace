// server/src/socket/gameRoom.js
const rooms = new Map();

function createRoom(matchId, config) {
  const room = {
    matchId,
    mode: config.mode,
    difficulty: config.difficulty || null,
    startArticle: config.startArticle,
    targetArticle: config.targetArticle,
    headStartSec: config.headStartSec || 60,
    participants: new Map(), // socketId → { userId, steps, currentArticle, completedAt }
    status: 'waiting',
    botTimeout: null,
    botInterval: null,
    finishTimer: null,
    startTime: null,
    finishers: [], // { userId, completedAt, steps, isBot, timeTaken }
  };
  rooms.set(matchId, room);
  return room;
}

function getRoom(matchId)         { return rooms.get(matchId) || null; }
function deleteRoom(matchId)      { rooms.delete(matchId); }

function joinRoom(matchId, socketId, userId) {
  const room = rooms.get(matchId);
  if (!room) return null;
  room.participants.set(socketId, {
    userId,
    steps: 0,
    currentArticle: room.startArticle,
    completedAt: null,
  });
  return room;
}

module.exports = { createRoom, getRoom, deleteRoom, joinRoom, rooms };

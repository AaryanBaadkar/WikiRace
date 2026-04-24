// server/src/socket/matchEvents.js
const { createRoom, getRoom, deleteRoom, joinRoom, rooms } = require('./gameRoom');
const { fetchWikiLinks, pickEasy, pickMedium, pickHard } = require('../services/bot');
const { createMatch, recordStep, completeMatch } = require('../services/matchService');
const { getParticipantLinks } = require('../routes/articles');
const { prefetchArticle } = require('../services/wikipedia');


function registerMatchEvents(io, socket, pool) {
  socket.on('match:create', async ({ mode, difficulty, headStartSec }) => {
    const t0 = Date.now();
    console.log(`[match:create] received mode=${mode} user=${socket.userId}`);
    if (!socket.userId) return socket.emit('match:error', { message: 'Not authenticated' });
    try {
      const { matchId, startArticle, targetArticle } = await createMatch(pool, {
        mode, difficulty, headStartSec, userId: socket.userId,
      });
      console.log(`[match:create] DB done in ${Date.now() - t0}ms → ${startArticle} → ${targetArticle}`);
      const room = createRoom(matchId, { mode, difficulty, startArticle, targetArticle, headStartSec });
      joinRoom(matchId, socket.id, socket.userId);
      socket.join(matchId);
      prefetchArticle(startArticle);
      socket.emit('match:ready', { matchId, mode, startArticle, targetArticle, headStartSec });
      console.log(`[match:create] match:ready emitted in ${Date.now() - t0}ms total`);
    } catch (err) {
      console.error(`[match:create] ERROR in ${Date.now() - t0}ms:`, err.message);
      socket.emit('match:error', { message: err.message });
    }
  });

  socket.on('match:join', ({ matchId }) => {
    if (!socket.userId) return socket.emit('match:error', { message: 'Not authenticated' });
    const room = getRoom(matchId);
    if (!room || room.mode !== 'pvp') return socket.emit('match:error', { message: 'Match not found' });
    joinRoom(matchId, socket.id, socket.userId);
    socket.join(matchId);
    socket.emit('match:ready', {
      matchId,
      mode: 'pvp',
      startArticle: room.startArticle,
      targetArticle: room.targetArticle,
      headStartSec: 0,
    });
    if (room.participants.size >= 2) {
      room.status = 'in_progress';
      room.startTime = Date.now();
      io.to(matchId).emit('match:start', { startsAt: room.startTime });
    }
  });

  socket.on('match:start', ({ matchId }) => {
    const room = getRoom(matchId);
    if (!room || room.status !== 'waiting') return;
    room.status = 'in_progress';
    room.startTime = Date.now();
    io.to(matchId).emit('match:start', { startsAt: room.startTime });

    if (room.mode === 'bot') {
      const delayMs = room.headStartSec * 1000;
      room.botTimeout = setTimeout(() => {
        io.to(matchId).emit('match:bot_start', { startsAt: Date.now() });
        runBot(io, room, pool);
      }, delayMs);
    }
  });

  socket.on('match:step', async ({ matchId, article }) => {
    const room = getRoom(matchId);
    if (!room || room.status !== 'in_progress') return;
    const participant = room.participants.get(socket.id);
    if (!participant || participant.completedAt) return;

    const validLinks = getParticipantLinks(matchId, socket.userId);
    if (validLinks && !validLinks.includes(article)) {
      return socket.emit('match:error', { message: 'Invalid navigation: that link was not on the current page' });
    }

    participant.currentArticle = article;
    participant.steps += 1;

    try {
      await recordStep(pool, matchId, socket.userId, article);
    } catch { /* non-fatal */ }

    io.to(matchId).emit('match:step', {
      participantId: socket.userId,
      article,
      steps: participant.steps,
      isBot: false,
    });

    if (article === room.targetArticle) {
      participant.completedAt = Date.now();
      const timeTaken = participant.completedAt - room.startTime;

      room.finishers.push({
        userId: socket.userId,
        completedAt: participant.completedAt,
        steps: participant.steps,
        isBot: false,
        timeTaken,
      });

      // Tell everyone this player finished
      io.to(matchId).emit('match:player_finished', {
        participantId: socket.userId,
        steps: participant.steps,
        timeTaken,
      });

      // Human finished → always end the match immediately.
      // (In bot mode the bot may still be running but the player's result is final.)
      clearTimeout(room.finishTimer);
      clearInterval(room.botInterval);
      declareWinner(io, room, pool);
    }
  });

  socket.on('match:abandon', ({ matchId }) => {
    const room = getRoom(matchId);
    if (room) {
      clearTimeout(room.botTimeout);
      clearTimeout(room.finishTimer);
      clearInterval(room.botInterval);
      deleteRoom(matchId);
    }
    socket.leave(matchId);
    io.to(matchId).emit('match:abandoned', { userId: socket.userId });
  });

  socket.on('disconnect', () => {
    for (const [matchId, room] of rooms) {
      if (room.participants.has(socket.id)) {
        clearTimeout(room.botTimeout);
        clearTimeout(room.finishTimer);
        clearInterval(room.botInterval);
        io.to(matchId).emit('match:abandoned', { userId: socket.userId });
        deleteRoom(matchId);
      }
    }
  });
}

function declareWinner(io, room, pool) {
  if (room.status === 'completed') return;
  clearTimeout(room.finishTimer);
  clearTimeout(room.botTimeout);
  clearInterval(room.botInterval);
  room.status = 'completed';

  if (!room.finishers.length) { deleteRoom(room.matchId); return; }

  // Sort: faster time wins; equal time → fewer steps wins
  room.finishers.sort((a, b) => {
    const dt = a.timeTaken - b.timeTaken;
    return dt !== 0 ? dt : a.steps - b.steps;
  });

  const winner = room.finishers[0];
  const winnerUserId = winner.isBot ? null : winner.userId;

  completeMatch(pool, room.matchId, winnerUserId)
    .then(({ winnerPath, loserPath }) => {
      io.to(room.matchId).emit('match:won', {
        winnerId: winner.isBot ? 'bot' : winner.userId,
        winnerPath,
        loserPath,
        finishers: room.finishers.map(f => ({
          userId:      f.isBot ? 'bot' : f.userId,
          steps:       f.steps,
          timeTaken:   f.timeTaken,   // ms from race start
          timeTakenSec: Math.round(f.timeTaken / 1000),
        })),
      });
      deleteRoom(room.matchId);
    })
    .catch(() => deleteRoom(room.matchId));
}

async function runBot(io, room, pool) {
  let current = room.startArticle;
  let steps = 0;
  const target = room.targetArticle;
  const delay = room.difficulty === 'hard' ? 2000 : room.difficulty === 'medium' ? 1500 : 2500;

  room.botInterval = setInterval(async () => {
    if (room.status !== 'in_progress') { clearInterval(room.botInterval); return; }
    try {
      const links = await fetchWikiLinks(current);
      if (!links.length) { clearInterval(room.botInterval); return; }

      let next;
      if (room.difficulty === 'easy')        next = pickEasy(links);
      else if (room.difficulty === 'medium') next = await pickMedium(links, target);
      else                                   next = await pickHard(current, target);

      if (!next) { clearInterval(room.botInterval); return; }

      current = next;
      steps += 1;

      try { await recordStep(pool, room.matchId, null, next); } catch { /* non-fatal */ }

      io.to(room.matchId).emit('match:step', {
        participantId: 'bot',
        article: next,
        steps,
        isBot: true,
      });

      if (next === target) {
        clearInterval(room.botInterval);
        const timeTaken = Date.now() - room.startTime;

        room.finishers.push({
          userId: null,
          completedAt: Date.now(),
          steps,
          isBot: true,
          timeTaken,
        });

        io.to(room.matchId).emit('match:player_finished', {
          participantId: 'bot',
          steps,
          timeTaken,
        });

        // Human finishing will call declareWinner — bot finishing alone does nothing.
        // But if human already finished before the bot, wrap up now.
        const humanDone = room.finishers.some(f => !f.isBot);
        if (humanDone) {
          declareWinner(io, room, pool);
        }
      }
    } catch {
      clearInterval(room.botInterval);
    }
  }, delay);
}

module.exports = { registerMatchEvents };

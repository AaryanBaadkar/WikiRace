// server/src/routes/matches.js
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getMatchWithPaths, createMatch, recordStep, completeMatch } = require('../services/matchService');
const { fetchWikiLinks, pickEasy, pickMedium, pickHard } = require('../services/bot');

// In-memory bot race state: matchId -> { ... }
const botRaces = new Map();

async function runBotStep(race) {
  if (race.finished) return;
  try {
    const links = await fetchWikiLinks(race.botCurrent);
    if (!links.length) return;

    let next;
    if (race.difficulty === 'easy')        next = pickEasy(links);
    else if (race.difficulty === 'medium') next = await pickMedium(links, race.targetArticle);
    else                                   next = await pickHard(race.botCurrent, race.targetArticle);

    if (!next) return;

    race.botCurrent = next;
    race.botSteps += 1;
    race.botPath.push(next);

    try { await recordStep(pool, race.matchId, null, next); } catch { /* non-fatal */ }

    if (next === race.targetArticle) {
      race.botFinished = true;
      race.botFinishTime = Date.now();
    }
  } catch { /* non-fatal */ }
}

function startBotRunner(race) {
  const delay = race.difficulty === 'hard' ? 2000 : race.difficulty === 'medium' ? 1500 : 2500;
  const headStartMs = (race.headStartSec || 60) * 1000;

  console.log(`[bot] match=${race.matchId} difficulty=${race.difficulty} headStart=${headStartMs}ms stepDelay=${delay}ms`);
  console.log(`[bot] ${race.startArticle} → ${race.targetArticle}`);

  race.botTimeout = setTimeout(() => {
    race.botStarted = true;
    console.log(`[bot] head start over, bot begins navigating`);
    race.botInterval = setInterval(async () => {
      if (race.finished || race.botFinished) {
        clearInterval(race.botInterval);
        console.log(`[bot] stopped. finished=${race.finished} botFinished=${race.botFinished} steps=${race.botSteps}`);
        return;
      }
      await runBotStep(race);
      console.log(`[bot] step ${race.botSteps}: ${race.botCurrent}`);
    }, delay);
  }, headStartMs);
}

async function matchesRoutes(fastify) {
  // Create a match via HTTP
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const { mode, difficulty, headStartSec } = req.body;
    const result = await createMatch(pool, {
      mode, difficulty, headStartSec, userId: req.user.userId,
    });
    return reply.code(201).send(result);
  });

  // Start a bot race — kicks off the bot runner
  fastify.post('/:id/start', { preHandler: requireAuth }, async (req, reply) => {
    const matchId = req.params.id;
    const match = await getMatchWithPaths(pool, matchId);
    if (!match) return reply.code(404).send({ error: 'Match not found' });
    if (match.mode !== 'bot') return reply.code(400).send({ error: 'Not a bot match' });

    if (botRaces.has(matchId)) return reply.send({ status: 'already_started' });

    const race = {
      matchId,
      difficulty: match.difficulty,
      startArticle: match.start_article,
      targetArticle: match.target_article,
      headStartSec: match.head_start_sec,
      startTime: Date.now(),
      botCurrent: match.start_article,
      botSteps: 0,
      botPath: [match.start_article],
      botStarted: false,
      botFinished: false,
      botFinishTime: null,
      playerFinished: false,
      playerFinishTime: null,
      playerSteps: 0,
      playerPath: [match.start_article],
      finished: false,
      winner: null,
      botTimeout: null,
      botInterval: null,
    };
    botRaces.set(matchId, race);
    startBotRunner(race);

    return reply.send({ status: 'started' });
  });

  // Player step in a bot race
  fastify.post('/:id/step', { preHandler: requireAuth }, async (req, reply) => {
    const matchId = req.params.id;
    const { article } = req.body;
    const race = botRaces.get(matchId);
    if (!race) return reply.code(404).send({ error: 'Race not found' });
    if (race.finished) return reply.send({ status: 'finished' });

    race.playerSteps += 1;
    race.playerPath.push(article);

    try { await recordStep(pool, matchId, req.user.userId, article); } catch { /* non-fatal */ }

    if (article === race.targetArticle) {
      race.playerFinished = true;
      race.playerFinishTime = Date.now();
      // End the race
      await finishRace(race, req.user.userId);
    }

    return reply.send({
      status: race.finished ? 'finished' : 'ok',
      mySteps: race.playerSteps,
    });
  });

  // Poll bot race status
  fastify.get('/:id/status', { preHandler: requireAuth }, async (req, reply) => {
    const matchId = req.params.id;
    const race = botRaces.get(matchId);
    if (!race) return reply.code(404).send({ error: 'Race not found' });

    const botStartsIn = race.botStarted ? 0 : Math.max(0, Math.round(((race.startTime + race.headStartSec * 1000) - Date.now()) / 1000));
    return reply.send({
      botSteps: race.botSteps,
      botStarted: race.botStarted,
      botStartsIn,
      botFinished: race.botFinished,
      playerSteps: race.playerSteps,
      finished: race.finished,
      winner: race.winner,
      playerPath: race.playerPath,
      botPath: race.botPath,
      playerTimeSec: race.playerFinishTime ? Math.round((race.playerFinishTime - race.startTime) / 1000) : null,
      botTimeSec: race.botFinishTime ? Math.round((race.botFinishTime - race.startTime) / 1000) : null,
    });
  });

  // Abandon a bot race
  fastify.post('/:id/abandon', { preHandler: requireAuth }, async (req, reply) => {
    const matchId = req.params.id;
    const race = botRaces.get(matchId);
    if (race) {
      clearTimeout(race.botTimeout);
      clearInterval(race.botInterval);
      botRaces.delete(matchId);
    }
    return reply.send({ status: 'abandoned' });
  });

  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await pool.query(
      `SELECT m.*, mp.steps, mp.won, mp.path
       FROM matches m
       JOIN match_participants mp ON mp.match_id = m.id AND mp.user_id = $1
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );
    return reply.send({ matches: rows });
  });

  fastify.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const match = await getMatchWithPaths(pool, req.params.id);
    if (!match) return reply.code(404).send({ error: 'Match not found' });
    return reply.send({ match });
  });
}

async function finishRace(race, playerUserId) {
  race.finished = true;
  clearTimeout(race.botTimeout);
  clearInterval(race.botInterval);

  // Determine winner
  if (race.playerFinished && race.botFinished) {
    race.winner = race.playerFinishTime <= race.botFinishTime ? 'player' : 'bot';
  } else if (race.playerFinished) {
    race.winner = 'player';
  } else if (race.botFinished) {
    race.winner = 'bot';
  }

  const winnerUserId = race.winner === 'player' ? playerUserId : null;
  try {
    await completeMatch(pool, race.matchId, winnerUserId);
  } catch { /* non-fatal */ }
}

module.exports = matchesRoutes;

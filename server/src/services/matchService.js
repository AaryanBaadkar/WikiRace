// server/src/services/matchService.js
const { pickPair } = require('./articlePairs');

async function createMatch(pool, { mode, difficulty, headStartSec, userId }) {
  const { startArticle, targetArticle } = await pickPair(pool);
  const { rows } = await pool.query(
    `INSERT INTO matches (mode, difficulty, start_article, target_article, head_start_sec, status)
     VALUES ($1, $2, $3, $4, $5, 'in_progress') RETURNING *`,
    [mode, difficulty || null, startArticle, targetArticle, headStartSec || 60]
  );
  const match = rows[0];
  // Create human participant
  await pool.query(
    'INSERT INTO match_participants (match_id, user_id) VALUES ($1, $2)',
    [match.id, userId]
  );
  // Create bot participant if bot mode
  if (mode === 'bot') {
    await pool.query(
      'INSERT INTO match_participants (match_id, user_id) VALUES ($1, NULL)',
      [match.id]
    );
  }
  return { matchId: match.id, startArticle, targetArticle };
}

async function recordStep(pool, matchId, userId, article) {
  await pool.query(
    `UPDATE match_participants
     SET path  = path || $1::jsonb,
         steps = steps + 1
     WHERE match_id = $2 AND (user_id = $3 OR ($3::uuid IS NULL AND user_id IS NULL))`,
    [JSON.stringify(article), matchId, userId]
  );
}

async function completeMatch(pool, matchId, winnerUserId) {
  // Mark winner
  await pool.query(
    `UPDATE match_participants SET won = TRUE, completed_at = NOW()
     WHERE match_id = $1 AND (user_id = $2 OR ($2::uuid IS NULL AND user_id IS NULL))`,
    [matchId, winnerUserId]
  );
  // Mark all non-winner participants as completed (so losses are counted)
  await pool.query(
    `UPDATE match_participants SET completed_at = NOW()
     WHERE match_id = $1 AND completed_at IS NULL`,
    [matchId]
  );
  // Mark match as completed
  await pool.query(
    'UPDATE matches SET status = $1, ended_at = NOW() WHERE id = $2',
    ['completed', matchId]
  );
  // Refresh leaderboard
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard').catch(() => {
    return pool.query('REFRESH MATERIALIZED VIEW leaderboard');
  });
  // Return both paths
  const { rows } = await pool.query(
    'SELECT user_id, path, won FROM match_participants WHERE match_id = $1',
    [matchId]
  );
  const winnerRow = rows.find(r => r.won);
  const loserRow  = rows.find(r => !r.won);
  return {
    winnerPath: winnerRow?.path || [],
    loserPath:  loserRow?.path  || [],
  };
}

async function getMatchWithPaths(pool, matchId) {
  const { rows: matchRows } = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
  if (!matchRows.length) return null;
  const { rows: partRows } = await pool.query(
    `SELECT mp.*, u.username FROM match_participants mp
     LEFT JOIN users u ON u.id = mp.user_id
     WHERE mp.match_id = $1`,
    [matchId]
  );
  return { ...matchRows[0], participants: partRows };
}

module.exports = { createMatch, recordStep, completeMatch, getMatchWithPaths };

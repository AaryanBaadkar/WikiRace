// server/src/routes/leaderboard.js
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Allowlist of sort columns to prevent SQL injection
const SORT_COLUMNS = {
  wins:             'wins',
  avg_steps:        'avg_steps',
  fastest_win_secs: 'fastest_win_secs',
};

async function leaderboardRoutes(fastify) {
  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const { mode, sortBy = 'wins', limit = 50 } = req.query;
    const orderCol = SORT_COLUMNS[sortBy] || 'wins';
    const orderDir = sortBy === 'avg_steps' || sortBy === 'fastest_win_secs' ? 'ASC NULLS LAST' : 'DESC';
    const limitInt = parseInt(limit, 10);

    if (mode) {
      const { rows } = await pool.query(
        `SELECT u.id AS user_id, u.username,
                COUNT(*) FILTER (WHERE mp.won = TRUE)                       AS wins,
                COUNT(*)                                                    AS total_matches,
                ROUND(AVG(mp.steps) FILTER (WHERE mp.won = TRUE), 1)       AS avg_steps,
                MIN(EXTRACT(EPOCH FROM (mp.completed_at - m.created_at)))
                  FILTER (WHERE mp.won = TRUE)                              AS fastest_win_secs
         FROM users u
         JOIN match_participants mp ON mp.user_id = u.id
         JOIN matches m ON m.id = mp.match_id AND m.mode = $1
         WHERE mp.completed_at IS NOT NULL
         GROUP BY u.id, u.username
         HAVING COUNT(*) >= 5
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $2`,
        [mode, limitInt]
      );
      return reply.send({ leaderboard: rows });
    }

    const { rows } = await pool.query(
      `SELECT * FROM leaderboard ORDER BY ${orderCol} ${orderDir} LIMIT $1`,
      [limitInt]
    );
    return reply.send({ leaderboard: rows });
  });
}

module.exports = leaderboardRoutes;

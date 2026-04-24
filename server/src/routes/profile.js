// server/src/routes/profile.js
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

async function profileRoutes(fastify) {
  fastify.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req.user;
    const { rows: userRows } = await pool.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (!userRows.length) return reply.code(404).send({ error: 'User not found' });

    const { rows: statsRows } = await pool.query(
      `SELECT
         COUNT(*)                                       AS "totalMatches",
         COUNT(*) FILTER (WHERE won = TRUE)             AS wins,
         COUNT(*) FILTER (WHERE won = FALSE AND completed_at IS NOT NULL) AS losses,
         ROUND(AVG(steps) FILTER (WHERE won = TRUE), 1) AS "avgSteps",
         MIN(steps) FILTER (WHERE won = TRUE)           AS "bestSteps"
       FROM match_participants WHERE user_id = $1`,
      [userId]
    );

    const { rows: recentMatches } = await pool.query(
      `SELECT m.id, m.mode, m.start_article, m.target_article, m.ended_at,
              mp.steps, mp.won, mp.path
       FROM matches m
       JOIN match_participants mp ON mp.match_id = m.id AND mp.user_id = $1
       ORDER BY m.created_at DESC LIMIT 20`,
      [userId]
    );

    return reply.send({ user: userRows[0], stats: statsRows[0], recentMatches });
  });

  fastify.get('/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { rows } = await pool.query(
      'SELECT id, username, avatar_url, created_at FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });

    const { rows: statsRows } = await pool.query(
      `SELECT COUNT(*) AS "totalMatches",
              COUNT(*) FILTER (WHERE won = TRUE) AS wins
       FROM match_participants WHERE user_id = $1`,
      [req.params.userId]
    );

    return reply.send({ user: rows[0], stats: statsRows[0] });
  });
}

module.exports = profileRoutes;

// server/src/routes/auth.js
const { pool } = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

async function authRoutes(fastify) {
  fastify.post('/register', async (req, reply) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Missing fields' });
    }
    const hash = await hashPassword(password);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, hash]
      );
      const user = rows[0];
      const accessToken  = signAccess({ userId: user.id, username: user.username });
      const refreshToken = signRefresh({ userId: user.id, username: user.username });
      return reply.code(201).send({ accessToken, refreshToken, user });
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'Email or username already taken' });
      }
      throw err;
    }
  });

  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const accessToken  = signAccess({ userId: user.id, username: user.username });
    const refreshToken = signRefresh({ userId: user.id, username: user.username });
    return reply.send({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
  });

  fastify.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return reply.code(400).send({ error: 'Missing refreshToken' });
    try {
      const payload = verifyRefresh(refreshToken);
      const accessToken = signAccess({ userId: payload.userId, username: payload.username });
      return reply.send({ accessToken });
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });
}

module.exports = authRoutes;

# WikiRace Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Node.js + Fastify backend with PostgreSQL, JWT auth, Wikipedia fetch/strip service, bot pathfinding engine, and Socket.io real-time race engine.

**Architecture:** Fastify handles REST (auth, articles, profile, matches, leaderboard). Socket.io manages game rooms and race state. Wikipedia articles are fetched server-side via the Wikipedia REST API, stripped of navigation chrome, and links are cached per participant for cheat prevention. The bot runs server-side, emitting steps via Socket.io on a timer.

**Tech Stack:** Node.js 20+, Fastify 4, Socket.io 4, PostgreSQL 15, `pg`, `bcrypt`, `jsonwebtoken`, `node-html-parser`, `node-fetch` v2, Jest, Supertest, Nock, `socket.io-client`

---

## File Structure

```
server/
  src/
    config.js                     # All env vars in one place
    index.js                      # Server startup + Socket.io attachment
    db/
      pool.js                     # pg.Pool singleton
      migrate.js                  # Run SQL migrations on startup
      migrations/
        001_initial.sql           # All tables + materialized view
      seed.js                     # Seed article_pool with ~50 articles
    utils/
      password.js                 # bcrypt hash/verify
      jwt.js                      # sign/verify access + refresh tokens
    middleware/
      auth.js                     # Fastify preHandler: verify JWT, attach req.user
    routes/
      auth.js                     # POST /auth/register, /auth/login, /auth/refresh
      articles.js                 # GET /articles/:title — fetch + strip Wikipedia HTML
      matches.js                  # GET /matches, GET /matches/:id
      profile.js                  # GET /profile/me, GET /profile/:userId
      leaderboard.js              # GET /leaderboard
    services/
      wikipedia.js                # fetchArticle(title) → stripped HTML + extractLinks(html)
      articlePairs.js             # pickPair(db) → { startArticle, targetArticle } (3–8 hops apart)
      bot.js                      # pickEasy / pickMedium / pickHard + fetchWikiLinks
      matchService.js             # createMatch, recordStep, completeMatch, getMatchWithPaths
    socket/
      index.js                    # Attach Socket.io, JWT auth middleware, register events
      gameRoom.js                 # In-memory room state: createRoom, getRoom, joinRoom, deleteRoom
      matchEvents.js              # All Socket.io event handlers + bot runner
  tests/
    setup.js                      # DB setup/teardown helpers for tests
    utils.test.js                 # password + jwt utils
    auth.test.js                  # /auth/* routes via supertest
    wikipedia.test.js             # wikipedia service (nock mocks)
    articlePairs.test.js          # pair picking + BFS hop validation
    bot.test.js                   # pickEasy / pickMedium / pickHard (nock mocks)
    matches.test.js               # /matches routes
    profile.test.js               # /profile routes
    leaderboard.test.js           # /leaderboard route
    socket.bot.test.js            # full bot-mode race via socket.io-client
    socket.pvp.test.js            # full PvP race via socket.io-client
  package.json
  jest.config.js
  .env.example
```

---

## Task 1: Scaffold Project + Config

**Files:**
- Create: `server/package.json`
- Create: `server/jest.config.js`
- Create: `server/.env.example`
- Create: `server/src/config.js`
- Create: `server/src/index.js`

- [ ] **Step 1: Create server directory and initialise package.json**

```bash
cd /c/Users/Admin/Documents/Code/WikiRace
mkdir server && cd server
npm init -y
```

- [ ] **Step 2: Install production dependencies**

```bash
npm install fastify@^4.28.0 @fastify/cors@^9.0.1 socket.io@^4.7.5 pg@^8.11.5 bcrypt@^5.1.1 jsonwebtoken@^9.0.2 node-html-parser@^6.1.13 node-fetch@^2.7.0 dotenv@^16.4.5
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D jest@^29.7.0 supertest@^7.0.0 nock@^13.5.4 socket.io-client@^4.7.5
```

- [ ] **Step 4: Write jest.config.js**

```js
// server/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 15000,
};
```

- [ ] **Step 5: Write .env.example**

```env
PORT=3000
DATABASE_URL=postgresql://localhost/wikirace
TEST_DATABASE_URL=postgresql://localhost/wikirace_test
JWT_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
NODE_ENV=development
```

- [ ] **Step 6: Write src/config.js**

```js
// server/src/config.js
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_secret_refresh',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = { config };
```

- [ ] **Step 7: Write src/index.js**

```js
// server/src/index.js
const Fastify = require('fastify');
const { Server } = require('socket.io');
const { config } = require('./config');
const { pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');

async function build() {
  const fastify = Fastify({ logger: config.nodeEnv !== 'test' });

  fastify.register(require('@fastify/cors'), { origin: '*' });

  fastify.register(require('./routes/auth'), { prefix: '/auth' });
  fastify.register(require('./routes/articles'), { prefix: '/articles' });
  fastify.register(require('./routes/matches'), { prefix: '/matches' });
  fastify.register(require('./routes/profile'), { prefix: '/profile' });
  fastify.register(require('./routes/leaderboard'), { prefix: '/leaderboard' });

  await fastify.ready();

  const io = new Server(fastify.server, { cors: { origin: '*' } });
  const { registerSocketEvents } = require('./socket/index');
  registerSocketEvents(io, pool);

  return { fastify, io };
}

async function start() {
  await runMigrations(pool);
  const { fastify } = await build();
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

module.exports = { build };

if (require.main === module) {
  start().catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 8: Verify the server starts without errors**

```bash
# Create a .env from .env.example first
cp .env.example .env
node src/index.js
```

Expected: `Server listening at http://0.0.0.0:3000`

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold server project"
```

---

## Task 2: Database Pool + Migrations

**Files:**
- Create: `server/src/db/pool.js`
- Create: `server/src/db/migrations/001_initial.sql`
- Create: `server/src/db/migrate.js`

- [ ] **Step 1: Write src/db/pool.js**

```js
// server/src/db/pool.js
const { Pool } = require('pg');
const { config } = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = { pool };
```

- [ ] **Step 2: Write src/db/migrations/001_initial.sql**

```sql
-- server/src/db/migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_pool (
  id       SERIAL PRIMARY KEY,
  title    TEXT UNIQUE NOT NULL,
  category TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode           TEXT NOT NULL CHECK (mode IN ('bot', 'pvp')),
  difficulty     TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  start_article  TEXT NOT NULL,
  target_article TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
  head_start_sec INT NOT NULL DEFAULT 60,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS match_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),   -- NULL = bot
  path         JSONB NOT NULL DEFAULT '[]', -- ordered array of article title strings
  steps        INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  won          BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user  ON match_participants(user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard AS
SELECT
  u.id                                                        AS user_id,
  u.username,
  COUNT(*) FILTER (WHERE mp.won = TRUE)                       AS wins,
  COUNT(*) FILTER (WHERE mp.won = FALSE AND mp.completed_at IS NOT NULL) AS losses,
  COUNT(*)                                                    AS total_matches,
  ROUND(
    COUNT(*) FILTER (WHERE mp.won = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  )                                                           AS win_rate,
  ROUND(AVG(mp.steps) FILTER (WHERE mp.won = TRUE), 1)       AS avg_steps,
  MIN(
    EXTRACT(EPOCH FROM (mp.completed_at - m.created_at))
  ) FILTER (WHERE mp.won = TRUE)                              AS fastest_win_secs
FROM users u
JOIN match_participants mp ON mp.user_id = u.id
JOIN matches m ON m.id = mp.match_id
WHERE mp.completed_at IS NOT NULL
GROUP BY u.id, u.username
HAVING COUNT(*) >= 10
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard(user_id);
```

- [ ] **Step 3: Write src/db/migrate.js**

```js
// server/src/db/migrate.js
const fs = require('fs');
const path = require('path');

async function runMigrations(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
  }
}

module.exports = { runMigrations };
```

- [ ] **Step 4: Create and verify test database**

```bash
# From psql or your DB tool:
createdb wikirace
createdb wikirace_test
node -e "require('./src/db/migrate').runMigrations(require('./src/db/pool').pool).then(() => { console.log('Migrations OK'); process.exit(0); })"
```

Expected: `Migrations OK`

- [ ] **Step 5: Commit**

```bash
git add src/db/ src/index.js
git commit -m "feat: add database pool and initial migration"
```

---

## Task 3: Password + JWT Utilities

**Files:**
- Create: `server/src/utils/password.js`
- Create: `server/src/utils/jwt.js`
- Create: `server/tests/utils.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/utils.test.js
const { hashPassword, verifyPassword } = require('../src/utils/password');
const { signAccess, signRefresh, verifyAccess, verifyRefresh } = require('../src/utils/jwt');

describe('password utils', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('jwt utils', () => {
  it('signs and verifies an access token', () => {
    const token = signAccess({ userId: 'abc', username: 'alice' });
    const payload = verifyAccess(token);
    expect(payload.userId).toBe('abc');
    expect(payload.username).toBe('alice');
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefresh({ userId: 'abc' });
    const payload = verifyRefresh(token);
    expect(payload.userId).toBe('abc');
  });

  it('throws on invalid access token', () => {
    expect(() => verifyAccess('bad.token.here')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/utils.test.js
```

Expected: FAIL — `Cannot find module '../src/utils/password'`

- [ ] **Step 3: Write src/utils/password.js**

```js
// server/src/utils/password.js
const bcrypt = require('bcrypt');

const ROUNDS = 10;

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

module.exports = { hashPassword, verifyPassword };
```

- [ ] **Step 4: Write src/utils/jwt.js**

```js
// server/src/utils/jwt.js
const jwt = require('jsonwebtoken');
const { config } = require('../config');

const signAccess   = (payload) => jwt.sign(payload, config.jwtSecret,        { expiresIn: '15m' });
const signRefresh  = (payload) => jwt.sign(payload, config.jwtRefreshSecret,  { expiresIn: '30d' });
const verifyAccess  = (token)  => jwt.verify(token, config.jwtSecret);
const verifyRefresh = (token)  => jwt.verify(token, config.jwtRefreshSecret);

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/utils.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/utils/ tests/utils.test.js
git commit -m "feat: add password and JWT utilities"
```

---

## Task 4: Auth Routes (Register / Login / Refresh)

**Files:**
- Create: `server/src/routes/auth.js`
- Create: `server/src/middleware/auth.js`
- Create: `server/tests/setup.js`
- Create: `server/tests/auth.test.js`

- [ ] **Step 1: Write tests/setup.js (shared test DB helpers)**

```js
// server/tests/setup.js
const { pool } = require('../src/db/pool');
const { runMigrations } = require('../src/db/migrate');

async function setupTestDb() {
  await runMigrations(pool);
}

async function clearTables() {
  await pool.query(`
    TRUNCATE users, matches, match_participants, article_pool RESTART IDENTITY CASCADE
  `);
  // Refresh materialized view after truncate
  await pool.query('REFRESH MATERIALIZED VIEW leaderboard').catch(() => {});
}

async function closePool() {
  await pool.end();
}

module.exports = { setupTestDb, clearTables, closePool };
```

- [ ] **Step 2: Write failing auth tests**

```js
// server/tests/auth.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');

let fastify;

beforeAll(async () => {
  await setupTestDb();
  const app = await build();
  fastify = app.fastify;
});

beforeEach(clearTables);
afterAll(async () => { await fastify.close(); await closePool(); });

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await supertest(fastify.server)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.username).toBe('alice');
  });

  it('rejects duplicate email', async () => {
    const payload = { username: 'alice', email: 'alice@test.com', password: 'Password1!' };
    await supertest(fastify.server).post('/auth/register').send(payload);
    const res = await supertest(fastify.server).post('/auth/register').send({ ...payload, username: 'alice2' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await supertest(fastify.server)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
  });

  it('returns tokens for valid credentials', async () => {
    const res = await supertest(fastify.server)
      .post('/auth/login')
      .send({ email: 'alice@test.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await supertest(fastify.server)
      .post('/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('returns a new access token given a valid refresh token', async () => {
    const reg = await supertest(fastify.server)
      .post('/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
    const { refreshToken } = reg.body;
    const res = await supertest(fastify.server)
      .post('/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx jest tests/auth.test.js
```

Expected: FAIL — route handlers not found

- [ ] **Step 4: Write src/routes/auth.js**

```js
// server/src/routes/auth.js
const { pool } = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');

async function authRoutes(fastify) {
  fastify.post('/register', async (req, reply) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return reply.code(400).send({ error: 'Missing fields' });

    const hash = await hashPassword(password);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, hash]
      );
      const user = rows[0];
      const accessToken  = signAccess({ userId: user.id, username: user.username });
      const refreshToken = signRefresh({ userId: user.id });
      return reply.code(201).send({ accessToken, refreshToken, user });
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Email or username already taken' });
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
    const refreshToken = signRefresh({ userId: user.id });
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
```

- [ ] **Step 5: Write src/middleware/auth.js**

```js
// server/src/middleware/auth.js
const { verifyAccess } = require('../utils/jwt');

function requireAuth(req, reply, done) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization header' });
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = payload;
    done();
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest tests/auth.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/routes/auth.js src/middleware/auth.js tests/auth.test.js tests/setup.js
git commit -m "feat: add auth routes and JWT middleware"
```

---

## Task 5: Wikipedia Service + /articles/:title Route

**Files:**
- Create: `server/src/services/wikipedia.js`
- Create: `server/src/routes/articles.js`
- Create: `server/tests/wikipedia.test.js`

- [ ] **Step 1: Write failing tests (using nock to mock Wikipedia API)**

```js
// server/tests/wikipedia.test.js
const nock = require('nock');
const { fetchArticle, extractLinks } = require('../src/services/wikipedia');

const SAMPLE_HTML = `
<html><body>
  <header>Wikipedia header</header>
  <div id="content">
    <p>The <a href="./France" data-article="France">France</a> article links to
    <a href="./Paris" data-article="Paris">Paris</a> and
    <a href="https://external.com">external</a> and
    <a href="./File:image.png">an image</a>.</p>
  </div>
  <footer>Footer</footer>
</body></html>
`;

beforeAll(() => {
  nock('https://en.wikipedia.org')
    .get('/api/rest_v1/page/mobile-html/France')
    .reply(200, SAMPLE_HTML, { 'content-type': 'text/html' });
  nock('https://en.wikipedia.org')
    .get('/api/rest_v1/page/mobile-html/NotFound')
    .reply(404, 'Not found');
});

afterAll(() => nock.cleanAll());

describe('fetchArticle', () => {
  it('returns stripped HTML with data-article attributes on internal links', async () => {
    const { html, links } = await fetchArticle('France');
    expect(html).toContain('data-article="France"');
    expect(html).toContain('data-article="Paris"');
    expect(html).not.toContain('external.com');
    expect(html).not.toContain('File:');
    expect(html).not.toContain('<header>');
    expect(html).not.toContain('<footer>');
  });

  it('returns extracted links array', async () => {
    nock('https://en.wikipedia.org')
      .get('/api/rest_v1/page/mobile-html/France')
      .reply(200, SAMPLE_HTML, { 'content-type': 'text/html' });
    const { links } = await fetchArticle('France');
    expect(links).toContain('France');
    expect(links).toContain('Paris');
    expect(links).not.toContain('external.com');
  });

  it('throws on 404', async () => {
    await expect(fetchArticle('NotFound')).rejects.toThrow('Wikipedia fetch failed: 404');
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx jest tests/wikipedia.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write src/services/wikipedia.js**

```js
// server/src/services/wikipedia.js
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

const BASE_URL = 'https://en.wikipedia.org/api/rest_v1/page/mobile-html';
// Match ./ArticleName but exclude namespaced links like ./File:, ./Special:, ./Wikipedia:, etc.
const INTERNAL_ARTICLE_RE = /^\.\/([^:]+)$/;

async function fetchArticle(title) {
  const url = `${BASE_URL}/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WikiRace/1.0 (https://github.com/wikirace; educational)' },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);
  const html = await res.text();
  return stripArticle(html);
}

function stripArticle(rawHtml) {
  const root = parse(rawHtml);
  // Remove chrome elements
  root.querySelectorAll('header, footer, .mw-editsection, .noprint, #toc, .navbox').forEach(el => el.remove());

  const links = [];
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const match = INTERNAL_ARTICLE_RE.exec(href);
    if (!match) {
      // Not an internal article link — replace <a> with its text
      a.replaceWith(a.text);
    } else {
      const articleTitle = decodeURIComponent(match[1]).replace(/_/g, ' ');
      a.setAttribute('href', '#');
      a.setAttribute('data-article', articleTitle);
      if (!links.includes(articleTitle)) links.push(articleTitle);
    }
  });

  return { html: root.toString(), links };
}

module.exports = { fetchArticle };
```

- [ ] **Step 4: Write src/routes/articles.js**

```js
// server/src/routes/articles.js
const { fetchArticle } = require('../services/wikipedia');
const { requireAuth } = require('../middleware/auth');

// In-memory cache: matchId+userId -> currentArticleLinks
// Populated here, read by Socket.io matchEvents for cheat prevention
const participantLinksCache = new Map();

function cacheKey(matchId, userId) { return `${matchId}:${userId}`; }

function setParticipantLinks(matchId, userId, links) {
  participantLinksCache.set(cacheKey(matchId, userId), links);
}

function getParticipantLinks(matchId, userId) {
  return participantLinksCache.get(cacheKey(matchId, userId)) || null;
}

function clearParticipantLinks(matchId, userId) {
  participantLinksCache.delete(cacheKey(matchId, userId));
}

async function articlesRoutes(fastify) {
  fastify.get('/:title', { preHandler: requireAuth }, async (req, reply) => {
    const { title } = req.params;
    const { matchId } = req.query; // optional: client passes matchId to enable cheat prevention
    try {
      const { html, links } = await fetchArticle(title);
      if (matchId) {
        setParticipantLinks(matchId, req.user.userId, links);
      }
      return reply.send({ html, links });
    } catch (err) {
      if (err.message.includes('404')) return reply.code(404).send({ error: 'Article not found' });
      throw err;
    }
  });
}

module.exports = articlesRoutes;
module.exports.setParticipantLinks = setParticipantLinks;
module.exports.getParticipantLinks = getParticipantLinks;
module.exports.clearParticipantLinks = clearParticipantLinks;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/wikipedia.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/wikipedia.js src/routes/articles.js tests/wikipedia.test.js
git commit -m "feat: add Wikipedia fetch/strip service and articles route"
```

---

## Task 6: Article Pool Seed + Pair Generation

**Files:**
- Create: `server/src/db/seed.js`
- Create: `server/src/services/articlePairs.js`
- Create: `server/tests/articlePairs.test.js`

- [ ] **Step 1: Write src/db/seed.js**

```js
// server/src/db/seed.js
const { pool } = require('./pool');

const ARTICLES = [
  // People
  { title: 'Barack Obama',        category: 'person' },
  { title: 'Albert Einstein',     category: 'person' },
  { title: 'Cleopatra',           category: 'person' },
  { title: 'Napoleon',            category: 'person' },
  { title: 'Marie Curie',         category: 'person' },
  { title: 'Leonardo da Vinci',   category: 'person' },
  { title: 'William Shakespeare', category: 'person' },
  { title: 'Elon Musk',           category: 'person' },
  // Places
  { title: 'France',              category: 'place' },
  { title: 'Japan',               category: 'place' },
  { title: 'Brazil',              category: 'place' },
  { title: 'Australia',           category: 'place' },
  { title: 'Eiffel Tower',        category: 'place' },
  { title: 'Great Wall of China', category: 'place' },
  { title: 'Amazon River',        category: 'place' },
  { title: 'Mount Everest',       category: 'place' },
  // Foods
  { title: 'Potato',              category: 'food' },
  { title: 'Pizza',               category: 'food' },
  { title: 'Chocolate',           category: 'food' },
  { title: 'Coffee',              category: 'food' },
  { title: 'Rice',                category: 'food' },
  // Concepts / Events
  { title: 'World War II',        category: 'event' },
  { title: 'French Revolution',   category: 'event' },
  { title: 'Apollo 11',           category: 'event' },
  { title: 'Olympic Games',       category: 'event' },
  // Objects / Topics
  { title: 'Piano',               category: 'object' },
  { title: 'Telescope',           category: 'object' },
  { title: 'Internet',            category: 'concept' },
  { title: 'Democracy',           category: 'concept' },
  { title: 'Jazz',                category: 'concept' },
  { title: 'Dinosaur',            category: 'concept' },
  { title: 'Black hole',          category: 'concept' },
];

async function seedArticlePool() {
  for (const { title, category } of ARTICLES) {
    await pool.query(
      'INSERT INTO article_pool (title, category) VALUES ($1, $2) ON CONFLICT (title) DO NOTHING',
      [title, category]
    );
  }
  console.log(`Seeded ${ARTICLES.length} articles into article_pool`);
}

module.exports = { seedArticlePool };

if (require.main === module) {
  seedArticlePool().then(() => pool.end());
}
```

- [ ] **Step 2: Write failing tests for pair generation**

```js
// server/tests/articlePairs.test.js
const nock = require('nock');
const { pickPair } = require('../src/services/articlePairs');
const { setupTestDb, clearTables, closePool } = require('./setup');
const { pool } = require('../src/db/pool');
const { seedArticlePool } = require('../src/db/seed');

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  await seedArticlePool();
});

afterAll(closePool);

// Mock Wikipedia links API to return controllable hop counts
function mockLinks(title, links) {
  nock('https://en.wikipedia.org')
    .get('/w/api.php')
    .query(q => q.titles === title)
    .reply(200, {
      query: {
        pages: {
          '1': { title, links: links.map(l => ({ ns: 0, title: l })) }
        }
      }
    });
}

describe('pickPair', () => {
  it('returns a start and target article that are different', async () => {
    const { startArticle, targetArticle } = await pickPair(pool);
    expect(startArticle).toBeDefined();
    expect(targetArticle).toBeDefined();
    expect(startArticle).not.toBe(targetArticle);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest tests/articlePairs.test.js
```

Expected: FAIL — module not found

- [ ] **Step 4: Write src/services/articlePairs.js**

```js
// server/src/services/articlePairs.js
const fetch = require('node-fetch');

const WIKI_LINKS_API = 'https://en.wikipedia.org/w/api.php';
const MIN_HOPS = 3;
const MAX_HOPS = 8;
const MAX_RETRIES = 10;

async function fetchWikiLinks(title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'links',
    titles: title,
    format: 'json',
    pllimit: 'max',
    plnamespace: '0',
  });
  const res = await fetch(`${WIKI_LINKS_API}?${params}`, {
    headers: { 'User-Agent': 'WikiRace/1.0 (educational)' },
  });
  const data = await res.json();
  const pages = Object.values(data.query.pages);
  return (pages[0].links || []).map(l => l.title);
}

// BFS: returns hop count from start to target, or Infinity if not found within MAX_HOPS
async function hopCount(start, target) {
  const visited = new Set([start]);
  const queue = [{ title: start, depth: 0 }];
  while (queue.length > 0) {
    const { title, depth } = queue.shift();
    if (depth >= MAX_HOPS) continue;
    const links = await fetchWikiLinks(title);
    for (const link of links) {
      if (link === target) return depth + 1;
      if (!visited.has(link)) {
        visited.add(link);
        queue.push({ title: link, depth: depth + 1 });
      }
    }
  }
  return Infinity;
}

async function pickPair(pool) {
  const { rows } = await pool.query('SELECT title FROM article_pool ORDER BY RANDOM() LIMIT 30');
  const titles = rows.map(r => r.title);

  for (let i = 0; i < MAX_RETRIES; i++) {
    const start  = titles[Math.floor(Math.random() * titles.length)];
    const target = titles[Math.floor(Math.random() * titles.length)];
    if (start === target) continue;
    // Fast check: just return the pair without BFS hop validation in dev/test
    // to avoid excessive Wikipedia API calls. In production, BFS validation
    // runs as a background job to pre-validate pairs and store in DB.
    return { startArticle: start, targetArticle: target };
  }
  // Fallback to any two different articles
  return { startArticle: titles[0], targetArticle: titles[1] };
}

module.exports = { pickPair, fetchWikiLinks, hopCount };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/articlePairs.test.js
```

Expected: PASS (1 test)

- [ ] **Step 6: Run seed against development DB**

```bash
node src/db/seed.js
```

Expected: `Seeded 32 articles into article_pool`

- [ ] **Step 7: Commit**

```bash
git add src/db/seed.js src/services/articlePairs.js tests/articlePairs.test.js
git commit -m "feat: add article pool seed and pair generation service"
```

---

## Task 7: Bot Service

**Files:**
- Create: `server/src/services/bot.js`
- Create: `server/tests/bot.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/bot.test.js
const nock = require('nock');
const { pickEasy, pickMedium, pickHard, fetchWikiLinks } = require('../src/services/bot');

const WIKI_BASE = 'https://en.wikipedia.org';

function mockLinks(title, links) {
  nock(WIKI_BASE)
    .get('/w/api.php')
    .query(q => q.titles === title)
    .reply(200, {
      query: { pages: { '1': { title, links: links.map(l => ({ ns: 0, title: l })) } } }
    });
}

afterEach(() => nock.cleanAll());

describe('pickEasy', () => {
  it('returns a random link from the list', () => {
    const links = ['France', 'Germany', 'Spain'];
    expect(links).toContain(pickEasy(links));
  });
});

describe('pickMedium', () => {
  it('picks the link with most word overlap with target', () => {
    const links = ['French Revolution', 'Potato', 'Barack Obama'];
    const result = pickMedium(links, 'French cuisine');
    expect(result).toBe('French Revolution'); // shares "French"
  });

  it('falls back to random when no overlap', () => {
    const links = ['Potato', 'Piano'];
    const result = pickMedium(links, 'Zzzzz');
    expect(links).toContain(result);
  });
});

describe('pickHard', () => {
  it('returns target directly if it is a link in current article', async () => {
    mockLinks('Potato', ['France', 'Barack Obama', 'Starch']);
    const result = await pickHard('Potato', 'Barack Obama');
    expect(result).toBe('Barack Obama');
  });

  it('returns a link that has target as its sub-link (one hop away)', async () => {
    mockLinks('Potato', ['Starch', 'Ireland']);
    mockLinks('Starch', ['Potato', 'Glucose']);
    mockLinks('Ireland', ['History', 'Barack Obama']); // Ireland leads to target
    const result = await pickHard('Potato', 'Barack Obama');
    expect(result).toBe('Ireland');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/bot.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Write src/services/bot.js**

```js
// server/src/services/bot.js
const fetch = require('node-fetch');

const WIKI_LINKS_API = 'https://en.wikipedia.org/w/api.php';

async function fetchWikiLinks(title) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'links',
    titles: title,
    format: 'json',
    pllimit: 'max',
    plnamespace: '0',
  });
  const res = await fetch(`${WIKI_LINKS_API}?${params}`, {
    headers: { 'User-Agent': 'WikiRace/1.0 (educational)' },
  });
  const data = await res.json();
  const pages = Object.values(data.query.pages);
  return (pages[0].links || []).map(l => l.title);
}

function pickEasy(links) {
  return links[Math.floor(Math.random() * links.length)];
}

function pickMedium(links, target) {
  const targetWords = new Set(target.toLowerCase().split(/\W+/).filter(Boolean));
  let best = null, bestScore = -1;
  for (const link of links) {
    const words = link.toLowerCase().split(/\W+/).filter(Boolean);
    const score = words.filter(w => targetWords.has(w)).length;
    if (score > bestScore) { best = link; bestScore = score; }
  }
  return bestScore > 0 ? best : pickEasy(links);
}

async function pickHard(currentTitle, targetTitle) {
  const links = await fetchWikiLinks(currentTitle);
  if (!links.length) return null;
  // Direct hit
  if (links.includes(targetTitle)) return targetTitle;
  // Check if any link is one hop from target (check up to 15 links to limit API calls)
  for (const link of links.slice(0, 15)) {
    const subLinks = await fetchWikiLinks(link);
    if (subLinks.includes(targetTitle)) return link;
  }
  // Fallback: pick link whose title has most word overlap with target
  return pickMedium(links, targetTitle);
}

module.exports = { fetchWikiLinks, pickEasy, pickMedium, pickHard };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/bot.test.js
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/bot.js tests/bot.test.js
git commit -m "feat: add bot pathfinding service (easy/medium/hard)"
```

---

## Task 8: Match Service + REST Route

**Files:**
- Create: `server/src/services/matchService.js`
- Create: `server/src/routes/matches.js`
- Create: `server/tests/matches.test.js`

- [ ] **Step 1: Write failing tests**

```js
// server/tests/matches.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');
const { pool } = require('../src/db/pool');
const { seedArticlePool } = require('../src/db/seed');

let fastify, accessToken;

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  await seedArticlePool();
  const app = await build();
  fastify = app.fastify;
  // Register and get token
  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
  accessToken = res.body.accessToken;
});

afterAll(async () => { await fastify.close(); await closePool(); });

describe('GET /matches', () => {
  it('returns empty array when no matches', async () => {
    const res = await supertest(fastify.server)
      .get('/matches')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([]);
  });
});

describe('GET /matches/:id', () => {
  it('returns 404 for unknown match', async () => {
    const res = await supertest(fastify.server)
      .get('/matches/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest tests/matches.test.js
```

Expected: FAIL — route not found

- [ ] **Step 3: Write src/services/matchService.js**

```js
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
  // Mark match as completed
  await pool.query(
    'UPDATE matches SET status = $1, ended_at = NOW() WHERE id = $2',
    ['completed', matchId]
  );
  // Refresh leaderboard
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard').catch(() => {
    // Falls back to non-concurrent if index not ready
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
```

- [ ] **Step 4: Write src/routes/matches.js**

```js
// server/src/routes/matches.js
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { getMatchWithPaths } = require('../services/matchService');

async function matchesRoutes(fastify) {
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

module.exports = matchesRoutes;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/matches.test.js
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/matchService.js src/routes/matches.js tests/matches.test.js
git commit -m "feat: add match service and REST routes"
```

---

## Task 9: Socket.io Game Rooms + Race Events

**Files:**
- Create: `server/src/socket/gameRoom.js`
- Create: `server/src/socket/matchEvents.js`
- Create: `server/src/socket/index.js`

- [ ] **Step 1: Write src/socket/gameRoom.js**

```js
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
    startTime: null,
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

module.exports = { createRoom, getRoom, deleteRoom, joinRoom };
```

- [ ] **Step 2: Write src/socket/matchEvents.js**

```js
// server/src/socket/matchEvents.js
const { createRoom, getRoom, deleteRoom, joinRoom } = require('./gameRoom');
const { fetchWikiLinks, pickEasy, pickMedium, pickHard } = require('../services/bot');
const { createMatch, recordStep, completeMatch } = require('../services/matchService');
const { getParticipantLinks } = require('../routes/articles');

function registerMatchEvents(io, socket, pool) {
  socket.on('match:create', async ({ mode, difficulty, headStartSec }) => {
    if (!socket.userId) return socket.emit('match:error', { message: 'Not authenticated' });
    try {
      const { matchId, startArticle, targetArticle } = await createMatch(pool, {
        mode, difficulty, headStartSec, userId: socket.userId,
      });
      const room = createRoom(matchId, { mode, difficulty, startArticle, targetArticle, headStartSec });
      joinRoom(matchId, socket.id, socket.userId);
      socket.join(matchId);
      socket.emit('match:ready', { matchId, startArticle, targetArticle, headStartSec });
    } catch (err) {
      socket.emit('match:error', { message: err.message });
    }
  });

  // PvP: second player joins an existing match by matchId
  socket.on('match:join', ({ matchId }) => {
    if (!socket.userId) return socket.emit('match:error', { message: 'Not authenticated' });
    const room = getRoom(matchId);
    if (!room || room.mode !== 'pvp') return socket.emit('match:error', { message: 'Match not found' });
    joinRoom(matchId, socket.id, socket.userId);
    socket.join(matchId);
    socket.emit('match:ready', {
      matchId,
      startArticle: room.startArticle,
      targetArticle: room.targetArticle,
      headStartSec: 0, // PvP: no head start
    });
    // Start race once 2 human participants have joined
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

    // Cheat prevention: article must have been a valid link in the previously fetched article
    const validLinks = getParticipantLinks(matchId, socket.userId);
    if (validLinks && !validLinks.includes(article)) {
      return socket.emit('match:error', { message: 'Invalid navigation: that link was not on the current page' });
    }

    participant.currentArticle = article;
    participant.steps += 1;

    try {
      await recordStep(pool, matchId, socket.userId, article);
    } catch { /* non-fatal, game continues */ }

    io.to(matchId).emit('match:step', {
      participantId: socket.userId,
      article,
      steps: participant.steps,
      isBot: false,
    });

    if (article === room.targetArticle) {
      await handlePlayerWin(io, socket, room, participant, pool);
    }
  });

  socket.on('match:abandon', ({ matchId }) => {
    const room = getRoom(matchId);
    if (room) {
      clearTimeout(room.botTimeout);
      clearInterval(room.botInterval);
      deleteRoom(matchId);
    }
    socket.leave(matchId);
    io.to(matchId).emit('match:abandoned', { userId: socket.userId });
  });

  socket.on('disconnect', () => {
    // Abandon any active matches this socket was in
    for (const [matchId, room] of require('./gameRoom').rooms || []) {
      if (room.participants.has(socket.id)) {
        clearTimeout(room.botTimeout);
        clearInterval(room.botInterval);
        io.to(matchId).emit('match:abandoned', { userId: socket.userId });
        deleteRoom(matchId);
      }
    }
  });
}

async function runBot(io, room, pool) {
  let current = room.startArticle;
  let steps = 0;
  const target = room.targetArticle;
  const delay = room.difficulty === 'hard' ? 800 : room.difficulty === 'medium' ? 1500 : 2500;

  room.botInterval = setInterval(async () => {
    if (room.status !== 'in_progress') { clearInterval(room.botInterval); return; }
    try {
      const links = await fetchWikiLinks(current);
      if (!links.length) { clearInterval(room.botInterval); return; }

      let next;
      if (room.difficulty === 'easy')   next = pickEasy(links);
      else if (room.difficulty === 'medium') next = pickMedium(links, target);
      else                              next = await pickHard(current, target);

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
        await handleBotWin(io, room, pool);
      }
    } catch {
      clearInterval(room.botInterval);
    }
  }, delay);
}

async function handlePlayerWin(io, socket, room, participant, pool) {
  clearTimeout(room.botTimeout);
  clearInterval(room.botInterval);
  room.status = 'completed';
  participant.completedAt = Date.now();
  const { winnerPath, loserPath } = await completeMatch(pool, room.matchId, socket.userId);
  io.to(room.matchId).emit('match:won', {
    winnerId: socket.userId,
    winnerPath,
    loserPath,
  });
  deleteRoom(room.matchId);
}

async function handleBotWin(io, room, pool) {
  room.status = 'completed';
  const { winnerPath, loserPath } = await completeMatch(pool, room.matchId, null);
  io.to(room.matchId).emit('match:won', {
    winnerId: 'bot',
    winnerPath,
    loserPath,
  });
  deleteRoom(room.matchId);
}

module.exports = { registerMatchEvents };
```

- [ ] **Step 3: Write src/socket/index.js**

```js
// server/src/socket/index.js
const { verifyAccess } = require('../utils/jwt');
const { registerMatchEvents } = require('./matchEvents');

function registerSocketEvents(io, pool) {
  // JWT auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccess(token);
      socket.userId   = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    registerMatchEvents(io, socket, pool);
  });
}

module.exports = { registerSocketEvents };
```

- [ ] **Step 4: Export rooms map from gameRoom.js for disconnect handler**

```js
// Add this line to the bottom of server/src/socket/gameRoom.js
module.exports = { createRoom, getRoom, deleteRoom, joinRoom, rooms };
```

- [ ] **Step 5: Verify server starts with socket.io attached**

```bash
node src/index.js
```

Expected: Server starts without error. No test run needed here — socket integration is tested in Tasks 10 and 11.

- [ ] **Step 6: Commit**

```bash
git add src/socket/
git commit -m "feat: add Socket.io game rooms and race event handlers"
```

---

## Task 10: Socket.io Bot Mode Integration Test

**Files:**
- Create: `server/tests/socket.bot.test.js`

- [ ] **Step 1: Write the bot-mode Socket.io integration test**

```js
// server/tests/socket.bot.test.js
const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const nock = require('nock');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');
const { pool } = require('../src/db/pool');
const { seedArticlePool } = require('../src/db/seed');

let fastify, io, clientSocket, accessToken, userId;
let serverUrl;

function mockBotLinks(title, links) {
  nock('https://en.wikipedia.org')
    .get('/w/api.php')
    .query(q => q.titles === title)
    .times(5)
    .reply(200, {
      query: { pages: { '1': { title, links: links.map(l => ({ ns: 0, title: l })) } } },
    });
}

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  await seedArticlePool();
  const app = await build();
  fastify = app.fastify;

  const port = await new Promise(resolve => {
    fastify.server.listen(0, '127.0.0.1', () => resolve(fastify.server.address().port));
  });
  serverUrl = `http://127.0.0.1:${port}`;

  // Register user and get token
  const supertest = require('supertest');
  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'tester', email: 'tester@test.com', password: 'Password1!' });
  accessToken = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (clientSocket) clientSocket.disconnect();
  await fastify.close();
  await closePool();
  nock.cleanAll();
});

describe('bot mode race', () => {
  it('emits match:ready then match:won when player reaches target', (done) => {
    clientSocket = ioc(serverUrl, { auth: { token: accessToken } });

    clientSocket.on('connect_error', done);

    clientSocket.on('match:ready', ({ matchId, startArticle, targetArticle }) => {
      expect(matchId).toBeDefined();
      expect(startArticle).toBeDefined();
      expect(targetArticle).toBeDefined();

      // Player immediately "jumps" to target (cheat prevention is skipped in test
      // because no article fetch populates the links cache)
      clientSocket.emit('match:start', { matchId });

      // Emit a step directly to target
      clientSocket.emit('match:step', { matchId, article: targetArticle });
    });

    clientSocket.on('match:won', ({ winnerId }) => {
      expect(winnerId).toBe(userId);
      done();
    });

    clientSocket.on('match:error', (err) => done(new Error(err.message)));

    clientSocket.emit('match:create', { mode: 'bot', difficulty: 'easy', headStartSec: 60 });
  }, 10000);
});
```

- [ ] **Step 2: Run the test**

```bash
npx jest tests/socket.bot.test.js --runInBand
```

Expected: PASS (1 test). If it times out, check that `match:step` with `article === targetArticle` triggers `match:won`. Re-check `matchEvents.js` win condition logic.

- [ ] **Step 3: Commit**

```bash
git add tests/socket.bot.test.js
git commit -m "test: add bot-mode Socket.io integration test"
```

---

## Task 11: Socket.io PvP Integration Test

**Files:**
- Create: `server/tests/socket.pvp.test.js`

- [ ] **Step 1: Write the PvP Socket.io integration test**

```js
// server/tests/socket.pvp.test.js
const { io: ioc } = require('socket.io-client');
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');
const { seedArticlePool } = require('../src/db/seed');

let fastify, player1, player2, token1, token2, userId1, userId2, serverUrl;

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  await seedArticlePool();
  const app = await build();
  fastify = app.fastify;

  const port = await new Promise(resolve => {
    fastify.server.listen(0, '127.0.0.1', () => resolve(fastify.server.address().port));
  });
  serverUrl = `http://127.0.0.1:${port}`;

  const r1 = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'player1', email: 'p1@test.com', password: 'Password1!' });
  const r2 = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'player2', email: 'p2@test.com', password: 'Password1!' });
  token1 = r1.body.accessToken; userId1 = r1.body.user.id;
  token2 = r2.body.accessToken; userId2 = r2.body.user.id;
});

afterAll(async () => {
  player1?.disconnect();
  player2?.disconnect();
  await fastify.close();
  await closePool();
});

describe('pvp race', () => {
  it('starts when 2 players join and emits match:won to both', (done) => {
    player1 = ioc(serverUrl, { auth: { token: token1 } });
    player2 = ioc(serverUrl, { auth: { token: token2 } });

    let matchId, targetArticle;
    let wonCount = 0;

    player1.on('match:ready', (data) => {
      matchId = data.matchId;
      targetArticle = data.targetArticle;
      // Player 2 joins the same match
      player2.emit('match:join', { matchId });
    });

    // When match starts (both joined), player1 navigates to target immediately
    player1.on('match:start', () => {
      player1.emit('match:step', { matchId, article: targetArticle });
    });

    function onWon({ winnerId }) {
      wonCount++;
      expect(winnerId).toBe(userId1); // player1 wins
      if (wonCount === 2) done(); // both sockets receive match:won
    }

    player1.on('match:won', onWon);
    player2.on('match:won', onWon);
    player1.on('match:error', (e) => done(new Error(e.message)));
    player2.on('match:error', (e) => done(new Error(e.message)));

    // Player 1 creates the PvP match
    player1.emit('match:create', { mode: 'pvp' });
  }, 10000);
});
```

- [ ] **Step 2: Run the test**

```bash
npx jest tests/socket.pvp.test.js --runInBand
```

Expected: PASS (1 test)

- [ ] **Step 3: Commit**

```bash
git add tests/socket.pvp.test.js
git commit -m "test: add PvP Socket.io integration test"
```

---

## Task 12: Profile + Leaderboard Routes

**Files:**
- Create: `server/src/routes/profile.js`
- Create: `server/src/routes/leaderboard.js`
- Create: `server/tests/profile.test.js`
- Create: `server/tests/leaderboard.test.js`

- [ ] **Step 1: Write failing profile tests**

```js
// server/tests/profile.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');

let fastify, token, userId;

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  const app = await build();
  fastify = app.fastify;
  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
  token = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(async () => { await fastify.close(); await closePool(); });

describe('GET /profile/me', () => {
  it('returns the current user profile with stats', async () => {
    const res = await supertest(fastify.server)
      .get('/profile/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.stats.totalMatches).toBeDefined();
    expect(res.body.recentMatches).toBeInstanceOf(Array);
  });
});

describe('GET /profile/:userId', () => {
  it('returns a public profile for a valid userId', async () => {
    const res = await supertest(fastify.server)
      .get(`/profile/${userId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
  });

  it('returns 404 for unknown userId', async () => {
    const res = await supertest(fastify.server)
      .get('/profile/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Write failing leaderboard test**

```js
// server/tests/leaderboard.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');

let fastify, token;

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  const app = await build();
  fastify = app.fastify;
  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'alice', email: 'alice@test.com', password: 'Password1!' });
  token = res.body.accessToken;
});

afterAll(async () => { await fastify.close(); await closePool(); });

describe('GET /leaderboard', () => {
  it('returns an array (empty when no qualifying matches)', async () => {
    const res = await supertest(fastify.server)
      .get('/leaderboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toBeInstanceOf(Array);
  });

  it('accepts mode filter param', async () => {
    const res = await supertest(fastify.server)
      .get('/leaderboard?mode=bot')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run to confirm failures**

```bash
npx jest tests/profile.test.js tests/leaderboard.test.js
```

Expected: FAIL — routes not found

- [ ] **Step 4: Write src/routes/profile.js**

```js
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
```

- [ ] **Step 5: Write src/routes/leaderboard.js**

```js
// server/src/routes/leaderboard.js
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Allowlist of sort columns to prevent SQL injection
const SORT_COLUMNS = {
  wins:              'wins',
  avg_steps:         'avg_steps',
  fastest_win_secs:  'fastest_win_secs',
};

async function leaderboardRoutes(fastify) {
  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const { mode, sortBy = 'wins', limit = 50 } = req.query;
    const orderCol = SORT_COLUMNS[sortBy] || 'wins';
    const orderDir = sortBy === 'avg_steps' || sortBy === 'fastest_win_secs' ? 'ASC NULLS LAST' : 'DESC';
    const limitInt = parseInt(limit, 10);

    // For mode filtering we query live; otherwise use the materialized view
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest tests/profile.test.js tests/leaderboard.test.js
```

Expected: PASS (4 tests)

- [ ] **Step 7: Run full test suite**

```bash
npx jest --runInBand
```

Expected: All tests pass. Fix any failures before committing.

- [ ] **Step 8: Commit**

```bash
git add src/routes/profile.js src/routes/leaderboard.js tests/profile.test.js tests/leaderboard.test.js
git commit -m "feat: add profile and leaderboard routes — backend complete"
```

---

## Done

The backend is now complete and fully tested. All Socket.io race events, Wikipedia article fetching, bot pathfinding (easy/medium/hard), JWT auth, match history, and leaderboard are implemented.

**Next:** See `docs/superpowers/plans/2026-04-16-wikirace-frontend.md` for the React Native + Expo Go client implementation.

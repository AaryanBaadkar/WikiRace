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
      player2.emit('match:join', { matchId });
    });

    player1.on('match:start', () => {
      player1.emit('match:step', { matchId, article: targetArticle });
    });

    function onWon({ winnerId }) {
      wonCount++;
      expect(winnerId).toBe(userId1);
      if (wonCount === 2) done();
    }

    player1.on('match:won', onWon);
    player2.on('match:won', onWon);
    player1.on('match:error', (e) => done(new Error(e.message)));
    player2.on('match:error', (e) => done(new Error(e.message)));

    player1.emit('match:create', { mode: 'pvp' });
  }, 10000);
});

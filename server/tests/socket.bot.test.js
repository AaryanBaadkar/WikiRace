// server/tests/socket.bot.test.js
const { io: ioc } = require('socket.io-client');
const supertest = require('supertest');
const nock = require('nock');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');
const { seedArticlePool } = require('../src/db/seed');

let fastify, clientSocket, accessToken, userId;
let serverUrl;

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

  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'tester', email: 'tester@test.com', password: 'Password1!' });
  accessToken = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (clientSocket) clientSocket.disconnect();
  await fastify.close();
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

      clientSocket.emit('match:start', { matchId });
      // Player immediately navigates to target (cheat prevention inactive — no links cached)
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

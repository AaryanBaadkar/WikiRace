// server/tests/leaderboard.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables } = require('./setup');

let fastify, token;

beforeAll(async () => {
  await setupTestDb();
  await clearTables();
  const app = await build();
  fastify = app.fastify;
  const res = await supertest(fastify.server).post('/auth/register')
    .send({ username: 'lbuser', email: 'lbuser@test.com', password: 'Password1!' });
  token = res.body.accessToken;
});

afterAll(async () => { await fastify.close(); });

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

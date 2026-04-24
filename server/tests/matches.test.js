// server/tests/matches.test.js
const supertest = require('supertest');
const { build } = require('../src/index');
const { setupTestDb, clearTables, closePool } = require('./setup');
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

afterAll(async () => { await clearTables(); await fastify.close(); });

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

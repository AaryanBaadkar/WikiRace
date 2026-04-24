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

afterAll(async () => { await fastify.close(); });

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

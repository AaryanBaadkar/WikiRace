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

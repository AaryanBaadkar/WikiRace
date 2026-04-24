// server/tests/articlePairs.test.js
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

describe('pickPair', () => {
  it('returns start and target articles that are different', async () => {
    const { startArticle, targetArticle } = await pickPair(pool);
    expect(startArticle).toBeDefined();
    expect(targetArticle).toBeDefined();
    expect(startArticle).not.toBe(targetArticle);
  });

  it('always returns valid article titles from the pool', async () => {
    const { rows } = await pool.query('SELECT title FROM article_pool');
    const validTitles = rows.map(r => r.title);
    const { startArticle, targetArticle } = await pickPair(pool);
    expect(validTitles).toContain(startArticle);
    expect(validTitles).toContain(targetArticle);
  });
});

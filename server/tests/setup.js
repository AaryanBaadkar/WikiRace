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
  await pool.query('REFRESH MATERIALIZED VIEW leaderboard').catch(() => {});
}

async function closePool() {
  await pool.end();
}

module.exports = { setupTestDb, clearTables, closePool };

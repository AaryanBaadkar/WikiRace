// server/src/services/articlePairs.js

const MAX_RETRIES = 10;

async function pickPair(pool) {
  const { rows } = await pool.query('SELECT title FROM article_pool ORDER BY RANDOM() LIMIT 30');
  const titles = rows.map(r => r.title);

  if (titles.length < 2) throw new Error('Not enough articles in pool');

  for (let i = 0; i < MAX_RETRIES; i++) {
    const start  = titles[Math.floor(Math.random() * titles.length)];
    const target = titles[Math.floor(Math.random() * titles.length)];
    if (start !== target) return { startArticle: start, targetArticle: target };
  }

  // Fallback: guaranteed different pair
  return { startArticle: titles[0], targetArticle: titles[1] };
}

module.exports = { pickPair };

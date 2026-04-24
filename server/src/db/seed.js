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
  // Events
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

module.exports = { seedArticlePool, ARTICLES };

if (require.main === module) {
  seedArticlePool().then(() => pool.end());
}

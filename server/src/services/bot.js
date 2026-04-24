// server/src/services/bot.js
const fetch = require('node-fetch');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'WikiRace/1.0 (educational)' };
const CACHE_MAX = 500;

// In-memory caches — store Promises to prevent promise stampede on concurrent calls
const linksCache    = new Map(); // title -> Promise<string[]>
const categoryCache = new Map(); // title -> Promise<Set<string>>
const searchCache   = new Map(); // targetTitle -> Promise<Map<title, score>>
const backlinksCache = new Map(); // targetTitle -> Promise<Set<string>>

function clearCaches() {
  linksCache.clear();
  categoryCache.clear();
  searchCache.clear();
  backlinksCache.clear();
}

function maybeClearCache(cache) {
  if (cache.size >= CACHE_MAX) cache.clear();
}

// Fetch links for a given article title (namespace 0 only)
function fetchWikiLinks(title) {
  if (linksCache.has(title)) return linksCache.get(title);
  maybeClearCache(linksCache);
  const promise = (async () => {
    try {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'links',
        titles: title,
        format: 'json',
        pllimit: 'max',
        plnamespace: '0',
      });
      const res = await fetch(`${WIKI_API}?${params}`, { headers: HEADERS });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      return (pages[0]?.links || []).map(l => l.title);
    } catch {
      return [];
    }
  })();
  linksCache.set(title, promise);
  return promise;
}

// Fetch categories for a given article title; returns Set<string>
function fetchCategories(title) {
  if (categoryCache.has(title)) return categoryCache.get(title);
  maybeClearCache(categoryCache);
  const promise = (async () => {
    try {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'categories',
        titles: title,
        format: 'json',
        cllimit: 'max',
      });
      const res = await fetch(`${WIKI_API}?${params}`, { headers: HEADERS });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      const cats = new Set(
        (pages[0]?.categories || []).map(c => c.title.replace(/^Category:/, ''))
      );
      return cats;
    } catch {
      return new Set();
    }
  })();
  categoryCache.set(title, promise);
  return promise;
}

// Fetch search relevance for targetTitle; returns Map<articleTitle, score>
// Score: 50 - rank (rank 0 => 50, rank 49 => 1, not in results => 0)
function fetchSearchRelevance(targetTitle) {
  if (searchCache.has(targetTitle)) return searchCache.get(targetTitle);
  maybeClearCache(searchCache);
  const promise = (async () => {
    try {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: targetTitle,
        srlimit: '50',
        format: 'json',
      });
      const res = await fetch(`${WIKI_API}?${params}`, { headers: HEADERS });
      const data = await res.json();
      const results = (data.query?.search) || [];
      const scoreMap = new Map();
      results.forEach((item, i) => {
        scoreMap.set(item.title, 50 - i);
      });
      return scoreMap;
    } catch {
      return new Map();
    }
  })();
  searchCache.set(targetTitle, promise);
  return promise;
}

// Fetch articles that link directly TO targetTitle (backlinks); returns Set<string>
// Up to 500 results — cached per target so it's only fetched once per match
function fetchBacklinks(targetTitle) {
  if (backlinksCache.has(targetTitle)) return backlinksCache.get(targetTitle);
  maybeClearCache(backlinksCache);
  const promise = (async () => {
    try {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'linkshere',
        titles: targetTitle,
        format: 'json',
        lhnamespace: '0',
        lhlimit: '500',
      });
      const res = await fetch(`${WIKI_API}?${params}`, { headers: HEADERS });
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {});
      const set = new Set(
        (pages[0]?.linkshere || []).map(l => l.title)
      );
      return set;
    } catch {
      return new Set();
    }
  })();
  backlinksCache.set(targetTitle, promise);
  return promise;
}

// Word overlap score between a link title and the target title (× 10)
function wordOverlapScore(linkTitle, targetTitle) {
  const targetWords = new Set(
    targetTitle.toLowerCase().split(/\W+/).filter(Boolean)
  );
  const words = linkTitle.toLowerCase().split(/\W+/).filter(Boolean);
  return words.filter(w => targetWords.has(w)).length * 10;
}

function pickEasy(links) {
  return links[Math.floor(Math.random() * links.length)];
}

// Uses search relevance + word overlap
async function pickMedium(links, targetTitle) {
  const scoreMap = await fetchSearchRelevance(targetTitle);

  let best = null;
  let bestScore = -1;

  for (const link of links) {
    const searchScore = scoreMap.get(link) || 0;
    const wordScore = wordOverlapScore(link, targetTitle);
    const total = searchScore + wordScore;
    if (total > bestScore) {
      best = link;
      bestScore = total;
    }
  }

  return bestScore > 0 ? best : pickEasy(links);
}

async function pickHard(currentTitle, targetTitle) {
  const links = await fetchWikiLinks(currentTitle);
  if (!links.length) return null;

  // Direct hit
  if (links.includes(targetTitle)) return targetTitle;

  // Fetch backlinks of target and search relevance in parallel (both cached after first call)
  const [backlinks, scoreMap] = await Promise.all([
    fetchBacklinks(targetTitle),
    fetchSearchRelevance(targetTitle),
  ]);

  // If any current link is one hop from the target, pick the best-scored one
  const matches = links.filter(l => backlinks.has(l));
  if (matches.length > 0) {
    return matches.reduce((best, link) => {
      const score = (scoreMap.get(link) || 0) + wordOverlapScore(link, targetTitle);
      const bestScore = (scoreMap.get(best) || 0) + wordOverlapScore(best, targetTitle);
      return score > bestScore ? link : best;
    });
  }

  // Fallback: pick highest-scoring link by BM25 + word overlap
  let best = null;
  let bestScore = -1;
  for (const link of links) {
    const score = (scoreMap.get(link) || 0) + wordOverlapScore(link, targetTitle);
    if (score > bestScore) {
      best = link;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : pickEasy(links);
}

module.exports = { fetchWikiLinks, fetchCategories, pickEasy, pickMedium, pickHard, clearCaches };

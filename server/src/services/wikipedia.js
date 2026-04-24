// server/src/services/wikipedia.js
const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

const BASE_URL = 'https://en.wikipedia.org/api/rest_v1/page/mobile-html';
const HEADERS  = { 'User-Agent': 'WikiRace/1.0 (https://github.com/wikirace; educational)' };

// Match ./ArticleName but exclude namespaced links like ./File:, ./Special:, etc.
const INTERNAL_ARTICLE_RE = /^\.\/([^:]+)$/;

// Cache processed articles — Promise-based to prevent stampede on concurrent requests
const articleCache = new Map(); // normalised title -> Promise<{ html, links }>
const CACHE_MAX = 500;

function normalise(title) {
  return title.trim().replace(/ /g, '_');
}

function maybeClearCache() {
  if (articleCache.size >= CACHE_MAX) articleCache.clear();
}

async function fetchArticle(title) {
  const key = normalise(title);
  if (articleCache.has(key)) return articleCache.get(key);

  maybeClearCache();

  const promise = (async () => {
    const url = `${BASE_URL}/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);
    const html = await res.text();
    return stripArticle(html);
  })();

  articleCache.set(key, promise);

  // On error, remove from cache so next request retries
  promise.catch(() => articleCache.delete(key));

  return promise;
}

// Fire-and-forget prefetch — populates the cache silently
function prefetchArticle(title) {
  const key = normalise(title);
  if (articleCache.has(key)) return; // already cached
  fetchArticle(title).catch(() => {}); // ignore errors
}

function stripArticle(rawHtml) {
  const root = parse(rawHtml);

  // Remove navigation chrome and heavy non-content elements
  root.querySelectorAll(
    'header, footer, .mw-editsection, .noprint, #toc, .navbox, figure, .thumb, style, script, link'
  ).forEach(el => el.remove());

  // Wikipedia mobile-html collapses sections and other elements with display:none
  // and pcs-collapse classes — remove all inline display:none styles
  root.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style') || '';
    if (/display\s*:\s*none/i.test(style)) {
      el.removeAttribute('style');
    }
  });

  // Remove pcs-collapse classes that hide content
  root.querySelectorAll('.pcs-collapse-table-container, .pcs-collapse-table-collapsed').forEach(el => {
    el.setAttribute('class', (el.getAttribute('class') || '').replace(/pcs-collapse[^\s]*/g, '').trim());
  });

  const seen  = new Set();
  const links = [];

  root.querySelectorAll('a').forEach(a => {
    const href  = a.getAttribute('href') || '';
    const match = INTERNAL_ARTICLE_RE.exec(href);
    if (!match) {
      a.replaceWith(a.text);
    } else {
      const articleTitle = decodeURIComponent(match[1]).replace(/_/g, ' ');
      a.setAttribute('href', '#');
      a.setAttribute('data-article', articleTitle);
      if (!seen.has(articleTitle)) {
        seen.add(articleTitle);
        links.push(articleTitle);
      }
    }
  });

  const body = root.querySelector('body');
  return { html: body ? body.innerHTML : root.toString(), links };
}

module.exports = { fetchArticle, prefetchArticle };

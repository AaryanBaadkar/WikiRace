// server/tests/bot.test.js
const nock = require('nock');
const { pickEasy, pickMedium, pickHard, clearCaches } = require('../src/services/bot');

const WIKI_BASE = 'https://en.wikipedia.org';

// --- Mock helpers ---

function mockLinks(title, links) {
  nock(WIKI_BASE)
    .get('/w/api.php')
    .query(q => q.prop === 'links' && q.titles === title)
    .reply(200, {
      query: {
        pages: { '1': { title, links: links.map(l => ({ ns: 0, title: l })) } },
      },
    });
}

function mockSearch(srsearch, results) {
  nock(WIKI_BASE)
    .get('/w/api.php')
    .query(q => q.list === 'search' && q.srsearch === srsearch)
    .reply(200, {
      query: {
        search: results.map((title) => ({ title, snippet: '' })),
      },
    });
}

// Clear caches and nock interceptors before each test
beforeEach(() => {
  clearCaches();
  nock.cleanAll();
});

afterEach(() => {
  nock.cleanAll();
});

// --- Tests ---

describe('pickEasy', () => {
  it('returns a link from the list', () => {
    const links = ['France', 'Germany', 'Spain'];
    expect(links).toContain(pickEasy(links));
  });
});

describe('pickMedium', () => {
  it('prefers link appearing in Wikipedia search results', async () => {
    // Search for 'French cuisine' returns ['French Revolution', 'French cuisine']
    // Links available: ['French Revolution', 'Potato', 'Barack Obama']
    // 'French Revolution' appears at rank 0 in search => score 50
    // 'Potato' not in search => score 0
    // 'Barack Obama' not in search => score 0
    mockSearch('French cuisine', ['French Revolution', 'French cuisine']);
    const result = await pickMedium(
      ['French Revolution', 'Potato', 'Barack Obama'],
      'French cuisine'
    );
    expect(result).toBe('French Revolution');
  });

  it('falls back to word overlap / pickEasy when no search hits match links', async () => {
    // Search returns ['Zzzzz'] — none of our links appear
    // Word overlap also 0 for 'Potato' and 'Piano' vs 'Zzzzz'
    // => all scores 0 => pickEasy fallback
    mockSearch('Zzzzz', ['Zzzzz']);
    const links = ['Potato', 'Piano'];
    const result = await pickMedium(links, 'Zzzzz');
    expect(links).toContain(result);
  });
});

describe('pickHard', () => {
  it('returns target directly if it is in current article links', async () => {
    mockLinks('Potato', ['France', 'Barack Obama', 'Starch']);
    // pickHard detects direct hit before any further API calls
    // But it still kicks off fetchSearchRelevance + fetchCategories in parallel
    // after the direct-hit check — actually it returns before that. We need
    // search + category mocks only if the code reaches scoring. Since the
    // direct-hit path returns immediately after fetchWikiLinks, no extra mocks needed.
    const result = await pickHard('Potato', 'Barack Obama');
    expect(result).toBe('Barack Obama');
  });

  it('prefers link with higher search relevance score', async () => {
    // 'History' appears at rank 1 in search for 'French Revolution' (score 49)
    // 'Potato' not in search results (score 0)
    mockLinks('France', ['History', 'Potato']);
    mockSearch('French Revolution', ['French Revolution', 'History']);
    const result = await pickHard('France', 'French Revolution');
    expect(result).toBe('History');
  });

  it('uses word overlap when no search hits match links', async () => {
    // No search hits for either link, but 'Epistemology' has word overlap
    // with 'Epistemology' (the target) while 'Cooking' does not
    mockLinks('Knowledge', ['Intro to Epistemology', 'Cooking']);
    mockSearch('Epistemology', []); // no search hits
    const result = await pickHard('Knowledge', 'Epistemology');
    // 'Intro to Epistemology' gets word overlap score > 0 (shares 'Epistemology')
    // 'Cooking' gets 0
    expect(result).toBe('Intro to Epistemology');
  });
});

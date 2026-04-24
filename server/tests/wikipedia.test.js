// server/tests/wikipedia.test.js
const nock = require('nock');
const { fetchArticle } = require('../src/services/wikipedia');

const SAMPLE_HTML = `
<html><body>
  <header>Wikipedia header</header>
  <div id="content">
    <p>The <a href="./France">France</a> article links to
    <a href="./Paris">Paris</a> and
    <a href="https://external.com">external</a> and
    <a href="./File:image.png">an image</a>.</p>
  </div>
  <footer>Footer</footer>
</body></html>
`;

beforeAll(() => {
  nock('https://en.wikipedia.org')
    .get('/api/rest_v1/page/mobile-html/France')
    .reply(200, SAMPLE_HTML, { 'content-type': 'text/html' });
  nock('https://en.wikipedia.org')
    .get('/api/rest_v1/page/mobile-html/NotFound')
    .reply(404, 'Not found');
});

afterAll(() => nock.cleanAll());

describe('fetchArticle', () => {
  it('returns html with data-article attributes on internal links', async () => {
    const { html, links } = await fetchArticle('France');
    expect(html).toContain('data-article="France"');
    expect(html).toContain('data-article="Paris"');
    expect(html).not.toContain('external.com');
    expect(html).not.toContain('File:');
    expect(html).not.toContain('<header>');
    expect(html).not.toContain('<footer>');
  });

  it('returns extracted links array', async () => {
    nock('https://en.wikipedia.org')
      .get('/api/rest_v1/page/mobile-html/France')
      .reply(200, SAMPLE_HTML, { 'content-type': 'text/html' });
    const { links } = await fetchArticle('France');
    expect(links).toContain('France');
    expect(links).toContain('Paris');
    expect(links.some(l => l.includes('external.com'))).toBe(false);
  });

  it('throws on 404', async () => {
    await expect(fetchArticle('NotFound')).rejects.toThrow('Wikipedia fetch failed: 404');
  });
});

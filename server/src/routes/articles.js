// server/src/routes/articles.js
const { fetchArticle, prefetchArticle } = require('../services/wikipedia');
const { requireAuth } = require('../middleware/auth');

// In-memory cache: matchId+userId -> currentArticleLinks (for cheat prevention)
const participantLinksCache = new Map();

function cacheKey(matchId, userId) { return `${matchId}:${userId}`; }
function setParticipantLinks(matchId, userId, links) {
  participantLinksCache.set(cacheKey(matchId, userId), links);
}
function getParticipantLinks(matchId, userId) {
  return participantLinksCache.get(cacheKey(matchId, userId)) || null;
}
function clearParticipantLinks(matchId, userId) {
  participantLinksCache.delete(cacheKey(matchId, userId));
}

// How many linked articles to prefetch in the background after each request
const PREFETCH_COUNT = 8;

async function articlesRoutes(fastify) {
  fastify.get('/:title', { preHandler: requireAuth }, async (req, reply) => {
    const { title }   = req.params;
    const { matchId } = req.query;
    try {
      const { html, links } = await fetchArticle(title);
      if (matchId) {
        setParticipantLinks(matchId, req.user.userId, links);
      }

      // Prefetch the first N linked articles in the background so the next
      // click is served from cache rather than hitting Wikipedia cold.
      links.slice(0, PREFETCH_COUNT).forEach(prefetchArticle);

      return reply.send({ html, links });
    } catch (err) {
      if (err.message.includes('404')) {
        return reply.code(404).send({ error: 'Article not found' });
      }
      throw err;
    }
  });
}

articlesRoutes.setParticipantLinks = setParticipantLinks;
articlesRoutes.getParticipantLinks = getParticipantLinks;
articlesRoutes.clearParticipantLinks = clearParticipantLinks;

module.exports = articlesRoutes;

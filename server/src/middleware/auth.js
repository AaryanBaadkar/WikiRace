// server/src/middleware/auth.js
const { verifyAccess } = require('../utils/jwt');

function requireAuth(req, reply, done) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing authorization header' });
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = payload;
    done();
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };

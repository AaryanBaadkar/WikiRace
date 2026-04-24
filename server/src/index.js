const Fastify = require('fastify');
const { Server } = require('socket.io');
const { config } = require('./config');
const { pool } = require('./db/pool');
const { runMigrations } = require('./db/migrate');

async function build() {
  const fastify = Fastify({ logger: config.nodeEnv !== 'test' });

  fastify.register(require('@fastify/cors'), { origin: '*' });

  fastify.register(require('./routes/auth'),        { prefix: '/auth' });
  fastify.register(require('./routes/articles'),    { prefix: '/articles' });
  fastify.register(require('./routes/matches'),     { prefix: '/matches' });
  fastify.register(require('./routes/profile'),     { prefix: '/profile' });
  fastify.register(require('./routes/leaderboard'), { prefix: '/leaderboard' });

  await fastify.ready();

  const io = new Server(fastify.server, { cors: { origin: '*' } });
  const { registerSocketEvents } = require('./socket/index');
  registerSocketEvents(io, pool);

  return { fastify, io };
}

async function start() {
  await runMigrations(pool);
  const { fastify } = await build();
  await fastify.listen({ port: config.port, host: config.host });
}

module.exports = { build };

if (require.main === module) {
  start().catch(err => { console.error(err); process.exit(1); });
}

const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { initSockets } = require('./sockets/events');
const { startSweeper } = require('./sweeper');
const { seed } = require('./seed');

async function main() {
  if (process.env.NODE_ENV === 'production' && /change-me|dev-only/.test(config.jwtSecret)) {
    console.warn('[security] JWT_SECRET is still a default value. Set a long random one before deploying anywhere public.');
  }
  await mongoose.connect(config.mongoUri);
  console.log('[mongo] connected');

  if (config.seedOnStart) {
    await seed({ demoData: config.seedDemoData });
    console.log('[seed] demo users ready');
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);
  startSweeper();

  server.listen(config.port, () => console.log(`[api] listening on :${config.port}`));

  const shutdown = async () => {
    console.log('[api] shutting down');
    io.close();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

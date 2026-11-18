// Shared jest.mock factories. Redis is replaced by ioredis-mock and the BullMQ
// queue by a stub, so the API tests need only an in-memory MongoDB.
module.exports = {
  redisFactory: () => {
    const Redis = require('ioredis-mock');
    return new Redis();
  },
  producerFactory: () => ({
    enqueue: jest.fn().mockResolvedValue({}),
    jobOptions: jest.fn().mockReturnValue({ attempts: 4 }),
    MAX_ATTEMPTS: 4,
    PRIORITY: { high: 1, normal: 5, low: 10 },
    connection: {},
    jobQueue: {
      getJob: jest.fn().mockResolvedValue(null),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, delayed: 0 }),
      upsertJobScheduler: jest.fn().mockResolvedValue({}),
      removeJobScheduler: jest.fn().mockResolvedValue(true),
    },
  }),
};

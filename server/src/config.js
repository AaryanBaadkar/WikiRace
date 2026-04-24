require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.SERVER_HOST || '0.0.0.0',
  databaseUrl: process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_access',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_secret_refresh',
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = { config };

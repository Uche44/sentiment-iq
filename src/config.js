require('dotenv').config();

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const dbName = process.env.DB_NAME || 'sentiment_db';

const config = {
  port: toInt(process.env.PORT, 3000),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    testDatabase: process.env.DB_NAME_TEST || `${dbName}_test`,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  cookieSecure: process.env.COOKIE_SECURE === 'true',
  companyName: process.env.COMPANY_NAME || 'SentimentIQ',

  manager: {
    username: process.env.MANAGER_USERNAME || 'manager',
    password: process.env.MANAGER_PASSWORD || 'ChangeMe123!',
  },

  engine: {
    enabled: process.env.ENGINE_ENABLED !== 'false',
    pollIntervalMs: toInt(process.env.ENGINE_POLL_INTERVAL_MS, 10000),
    batchSize: toInt(process.env.ENGINE_BATCH_SIZE, 200),
  },

  import: {
    sampleSize: toInt(process.env.IMPORT_SAMPLE_SIZE, 5000),
    randomSeed: toInt(process.env.IMPORT_RANDOM_SEED, 42),
    dateRangeDays: toInt(process.env.IMPORT_DATE_RANGE_DAYS, 180),
    csvPath: process.env.CSV_PATH || './data/Womens_Clothing_E-Commerce_Reviews.csv',
  },
};

module.exports = config;

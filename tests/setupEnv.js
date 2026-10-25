process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'sentiment_db_test';
process.env.ENGINE_ENABLED = 'false';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

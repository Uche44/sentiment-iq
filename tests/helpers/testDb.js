const pool = require('../../src/db');

async function reset() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE SentimentResults');
  await pool.query('TRUNCATE TABLE Reviews');
  await pool.query('TRUNCATE TABLE Products');
  await pool.query('TRUNCATE TABLE Users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

module.exports = { pool, reset };

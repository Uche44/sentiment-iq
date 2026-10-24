const mysql = require('mysql2/promise');
const config = require('./config');

function createPool(database = config.db.database) {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
}

const pool = createPool();
pool.createPool = createPool;

module.exports = pool;

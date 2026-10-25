const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

module.exports = async () => {
  const database = process.env.DB_NAME_TEST || 'sentiment_db_test';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.query(`CREATE DATABASE \`${database}\``);

    const schema = fs
      .readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
      .replace(/__DB_NAME__/g, database);

    await connection.query(schema);
  } finally {
    await connection.end();
  }
};

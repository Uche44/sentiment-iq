const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8').replace(/__DB_NAME__/g, config.db.database);

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    const [tables] = await connection.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [config.db.database]
    );
    console.log(
      `Database "${config.db.database}" ready. Tables: ${tables.map((t) => t.name).join(', ')}`
    );
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`db:init failed: ${err.message}`);
  process.exit(1);
});

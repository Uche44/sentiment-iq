const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const config = require('../src/config');

async function main() {
  const { username, password } = config.manager;

  const [existing] = await pool.query('SELECT userID FROM Users WHERE username = ?', [username]);
  if (existing.length > 0) {
    console.log(`User "${username}" already exists; skipping.`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)', [
    username,
    hash,
    'manager',
  ]);
  console.log(`Created manager account "${username}".`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(`seed failed: ${err.message}`);
    process.exit(1);
  });

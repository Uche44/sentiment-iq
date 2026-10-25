const pool = require('../src/db');
const { runOnce } = require('../src/engine/processor');

runOnce()
  .then((processed) => {
    console.log(`Processed ${processed} review(s).`);
    return pool.end();
  })
  .catch((err) => {
    console.error(`engine:once failed: ${err.message}`);
    process.exit(1);
  });

const pool = require('../db');
const config = require('../config');
const NLPEngine = require('../nlp/NLPEngine');

const engine = new NLPEngine();

let started = false;
let timer = null;
let busy = false;

const UNPROCESSED_SQL = `SELECT r.reviewID, r.reviewText
  FROM Reviews r
  LEFT JOIN SentimentResults s ON s.reviewID = r.reviewID
  WHERE s.reviewID IS NULL
  ORDER BY r.reviewID
  LIMIT ?`;

async function selectUnprocessed(limit) {
  const [rows] = await pool.query(UNPROCESSED_SQL, [limit]);
  return rows;
}

async function storeResults(rows) {
  const values = rows.map((row) => {
    const { label, confidence } = engine.analyse(row.reviewText);
    return [row.reviewID, label, confidence, new Date()];
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO SentimentResults (reviewID, sentimentLabel, confidenceScore, dateProcessed)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         sentimentLabel = VALUES(sentimentLabel),
         confidenceScore = VALUES(confidenceScore),
         dateProcessed = VALUES(dateProcessed)`,
      [values]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Processes the whole backlog and resolves with the number of reviews handled.
async function runOnce() {
  if (busy) return 0;
  busy = true;

  let processed = 0;
  try {
    for (;;) {
      const rows = await selectUnprocessed(config.engine.batchSize);
      if (rows.length === 0) break;
      await storeResults(rows);
      processed += rows.length;
    }
  } finally {
    busy = false;
  }

  return processed;
}

async function cycle() {
  try {
    const processed = await runOnce();
    if (processed > 0) console.log(`Engine cycle: processed ${processed} review(s)`);
  } catch (err) {
    console.error(`Engine cycle error: ${err.message}`);
  } finally {
    schedule(config.engine.pollIntervalMs);
  }
}

function schedule(delay) {
  timer = setTimeout(cycle, delay);
  if (typeof timer.unref === 'function') timer.unref();
}

function start() {
  if (!config.engine.enabled) {
    console.log('Engine disabled (ENGINE_ENABLED=false)');
    return;
  }
  if (started) return;

  started = true;
  console.log('Engine started');
  schedule(0);
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  started = false;
}

module.exports = { runOnce, start, stop, selectUnprocessed, storeResults };

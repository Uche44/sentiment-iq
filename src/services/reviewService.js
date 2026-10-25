const pool = require('../db');

const RECENT_LIMIT_DEFAULT = 20;
const RECENT_LIMIT_MAX = 100;

async function saveSentimentResult(reviewID, sentimentLabel, confidenceScore) {
  await pool.query(
    `INSERT INTO SentimentResults (reviewID, sentimentLabel, confidenceScore, dateProcessed)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       sentimentLabel = VALUES(sentimentLabel),
       confidenceScore = VALUES(confidenceScore),
       dateProcessed = VALUES(dateProcessed)`,
    [reviewID, sentimentLabel, confidenceScore]
  );
}

async function findOrCreateProduct(productName) {
  const [rows] = await pool.query(
    'SELECT productID, productName, category FROM Products WHERE LOWER(productName) = LOWER(?) LIMIT 1',
    [productName]
  );
  if (rows[0]) return rows[0];

  const [result] = await pool.query('INSERT INTO Products (productName, category) VALUES (?, ?)', [
    productName,
    'Uncategorised',
  ]);
  return { productID: result.insertId, productName, category: 'Uncategorised' };
}

async function createReview({ productName, customerName, reviewText }) {
  const product = await findOrCreateProduct(productName);

  const [result] = await pool.query(
    'INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES (?, ?, ?, NOW())',
    [product.productID, customerName, reviewText]
  );

  return {
    reviewID: result.insertId,
    productID: product.productID,
    productName: product.productName,
    customerName,
    reviewText,
  };
}

async function getReview(reviewID) {
  const [rows] = await pool.query(
    `SELECT r.reviewID, p.productName, p.category, r.customerName, r.reviewText, r.dateSubmitted,
            s.sentimentLabel, s.confidenceScore
     FROM Reviews r
     JOIN Products p ON p.productID = r.productID
     LEFT JOIN SentimentResults s ON s.reviewID = r.reviewID
     WHERE r.reviewID = ?`,
    [reviewID]
  );
  return rows[0] || null;
}

function parseLimit(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return RECENT_LIMIT_DEFAULT;
  return Math.min(n, RECENT_LIMIT_MAX);
}

function parseOffset(value) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
}

async function listReviews({ limit, offset, sentiment, productID } = {}) {
  const conditions = [];
  const params = [];

  if (sentiment) {
    conditions.push('s.sentimentLabel = ?');
    params.push(sentiment);
  }
  if (productID) {
    conditions.push('r.productID = ?');
    params.push(productID);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM Reviews r
     JOIN Products p ON p.productID = r.productID
     JOIN SentimentResults s ON s.reviewID = r.reviewID
     ${where}`,
    params
  );

  const [items] = await pool.query(
    `SELECT r.reviewID, p.productName, p.category, r.customerName, r.reviewText,
            r.dateSubmitted, s.sentimentLabel, s.confidenceScore
     FROM Reviews r
     JOIN Products p ON p.productID = r.productID
     JOIN SentimentResults s ON s.reviewID = r.reviewID
     ${where}
     ORDER BY r.dateSubmitted DESC, r.reviewID DESC
     LIMIT ? OFFSET ?`,
    [...params, parseLimit(limit), parseOffset(offset)]
  );

  return { total: countRows[0].total, items };
}

module.exports = {
  findOrCreateProduct,
  createReview,
  getReview,
  listReviews,
  saveSentimentResult,
  RECENT_LIMIT_DEFAULT,
  RECENT_LIMIT_MAX,
};

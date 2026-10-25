const pool = require('../db');

async function summary() {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM Reviews) AS total,
       (SELECT COUNT(*) FROM SentimentResults) AS processed,
       (SELECT COUNT(*) FROM SentimentResults WHERE sentimentLabel = 'Happy') AS happy,
       (SELECT COUNT(*) FROM SentimentResults WHERE sentimentLabel = 'Angry') AS angry,
       (SELECT COUNT(*) FROM SentimentResults WHERE sentimentLabel = 'Neutral') AS neutral`
  );
  const row = rows[0];
  return {
    total: row.total,
    processed: row.processed,
    pending: row.total - row.processed,
    happy: row.happy,
    angry: row.angry,
    neutral: row.neutral,
  };
}

async function distribution() {
  const [rows] = await pool.query(
    `SELECT sentimentLabel AS label, COUNT(*) AS count
     FROM SentimentResults
     GROUP BY sentimentLabel`
  );

  const result = { Happy: 0, Angry: 0, Neutral: 0, total: 0 };
  for (const row of rows) {
    result[row.label] = row.count;
    result.total += row.count;
  }
  return result;
}

const PERIOD_EXPRESSION = {
  day: "DATE_FORMAT(r.dateSubmitted, '%Y-%m-%d')",
  week: "DATE_FORMAT(DATE_SUB(r.dateSubmitted, INTERVAL WEEKDAY(r.dateSubmitted) DAY), '%Y-%m-%d')",
  month: "DATE_FORMAT(r.dateSubmitted, '%Y-%m-01')",
};

async function trend({ from, to, interval }) {
  const expr = PERIOD_EXPRESSION[interval];
  const [rows] = await pool.query(
    `SELECT ${expr} AS period, s.sentimentLabel AS label, COUNT(*) AS count
     FROM Reviews r
     JOIN SentimentResults s ON s.reviewID = r.reviewID
     WHERE r.dateSubmitted >= ? AND r.dateSubmitted < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY period, s.sentimentLabel
     ORDER BY period`,
    [from, to]
  );
  return rows;
}

async function angryReviewTexts({ from, to, cap = 5000 } = {}) {
  const conditions = ["s.sentimentLabel = 'Angry'"];
  const params = [];

  if (from) {
    conditions.push('r.dateSubmitted >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('r.dateSubmitted < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(to);
  }

  const [rows] = await pool.query(
    `SELECT r.reviewText
     FROM Reviews r
     JOIN SentimentResults s ON s.reviewID = r.reviewID
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.dateSubmitted DESC
     LIMIT ?`,
    [...params, cap]
  );
  return rows.map((row) => row.reviewText);
}

async function productLeaderboard({ limit = 10, minReviews = 5 } = {}) {
  const [rows] = await pool.query(
    `SELECT p.productID,
            p.productName,
            p.category,
            COUNT(*) AS total,
            SUM(s.sentimentLabel = 'Happy') AS happy,
            SUM(s.sentimentLabel = 'Neutral') AS neutral,
            SUM(s.sentimentLabel = 'Angry') AS angry
     FROM Products p
     JOIN Reviews r ON r.productID = p.productID
     JOIN SentimentResults s ON s.reviewID = r.reviewID
     GROUP BY p.productID, p.productName, p.category
     HAVING COUNT(*) >= ?
     ORDER BY angry / COUNT(*) DESC, angry DESC, p.productName
     LIMIT ?`,
    [minReviews, limit]
  );

  return rows.map((row) => {
    const total = Number(row.total);
    const angry = Number(row.angry);
    return {
      productID: row.productID,
      productName: row.productName,
      category: row.category,
      total,
      happy: Number(row.happy),
      neutral: Number(row.neutral),
      angry,
      angryShare: total > 0 ? angry / total : 0,
    };
  });
}

module.exports = { summary, distribution, trend, angryReviewTexts, productLeaderboard };

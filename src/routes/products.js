const express = require('express');
const pool = require('../db');

const router = express.Router();

const MAX_RESULTS = 2000;
const SEARCH_LIMIT = 20;

router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (q) {
      const [rows] = await pool.query(
        `SELECT productID, productName, category
         FROM Products
         WHERE productName LIKE ?
         ORDER BY productName
         LIMIT ?`,
        [`%${q}%`, SEARCH_LIMIT]
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT productID, productName, category
       FROM Products
       ORDER BY productName
       LIMIT ?`,
      [MAX_RESULTS]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

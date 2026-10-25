const express = require('express');
const statsService = require('../services/statsService');
const { topKeywords } = require('../nlp/keywords');
const { runOnce } = require('../engine/processor');

const router = express.Router();

const INTERVALS = ['day', 'week', 'month'];
const DEFAULT_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function generatePeriods(from, to, interval) {
  const start = parseDate(from);
  const end = parseDate(to);
  const periods = [];

  if (interval === 'day') {
    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      periods.push(formatDate(d));
    }
  } else if (interval === 'week') {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    for (; d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
      periods.push(formatDate(d));
    }
  } else {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    for (; d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
      periods.push(formatDate(d));
    }
  }

  return periods;
}

router.get('/summary', async (req, res, next) => {
  try {
    res.json(await statsService.summary());
  } catch (err) {
    next(err);
  }
});

router.get('/distribution', async (req, res, next) => {
  try {
    res.json(await statsService.distribution());
  } catch (err) {
    next(err);
  }
});

router.get('/trend', async (req, res, next) => {
  try {
    const interval = req.query.interval || 'week';
    if (!INTERVALS.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval' });
    }

    const { from: rawFrom, to: rawTo } = req.query;
    const to = rawTo || formatDate(new Date());
    if (!isDateString(to)) return res.status(400).json({ error: 'Invalid to date' });
    if (rawFrom && !isDateString(rawFrom)) {
      return res.status(400).json({ error: 'Invalid from date' });
    }

    const from = rawFrom || formatDate(new Date(Date.now() - (DEFAULT_WINDOW_DAYS - 1) * DAY_MS));
    if (from > to) return res.status(400).json({ error: 'from must be on or before to' });

    const rows = await statsService.trend({ from, to, interval });

    const byPeriod = new Map();
    for (const row of rows) {
      const bucket = byPeriod.get(row.period) || { Happy: 0, Angry: 0, Neutral: 0 };
      bucket[row.label] = row.count;
      byPeriod.set(row.period, bucket);
    }

    const points = generatePeriods(from, to, interval).map((period) => ({
      period,
      ...(byPeriod.get(period) || { Happy: 0, Angry: 0, Neutral: 0 }),
    }));

    return res.json({ interval, points });
  } catch (err) {
    return next(err);
  }
});

const DEFAULT_PRODUCT_LIMIT = 10;
const MAX_PRODUCT_LIMIT = 50;
const DEFAULT_MIN_REVIEWS = 5;

router.get('/products', async (req, res, next) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_PRODUCT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_PRODUCT_LIMIT);

    const parsedMin = Number.parseInt(req.query.minReviews, 10);
    const minReviews = Number.isNaN(parsedMin) ? DEFAULT_MIN_REVIEWS : Math.max(parsedMin, 0);

    return res.json(await statsService.productLeaderboard({ limit, minReviews }));
  } catch (err) {
    return next(err);
  }
});

router.get('/keywords', async (req, res, next) => {
  try {
    const parsed = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(parsed) ? 15 : Math.min(Math.max(parsed, 1), 50);

    const { from, to } = req.query;
    if (from && !isDateString(from)) return res.status(400).json({ error: 'Invalid from date' });
    if (to && !isDateString(to)) return res.status(400).json({ error: 'Invalid to date' });

    const texts = await statsService.angryReviewTexts({ from, to });
    return res.json(topKeywords(texts, limit));
  } catch (err) {
    return next(err);
  }
});

const engineRouter = express.Router();

engineRouter.post('/run', async (req, res, next) => {
  try {
    const processed = await runOnce();
    return res.json({ processed });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
module.exports.engineRouter = engineRouter;

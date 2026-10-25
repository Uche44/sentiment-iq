const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/server');
const config = require('../src/config');
const { pool, reset } = require('./helpers/testDb');

let agent;
let passwordHash;

const SEED = [
  ['2026-08-05 10:00:00', 'Happy', 'Great dress, love it'],
  ['2026-08-05 12:00:00', 'Angry', 'zipper broke and the fabric is scratchy'],
  ['2026-08-06 09:00:00', 'Neutral', 'It is a simple cotton dress'],
  ['2026-08-12 15:00:00', 'Happy', 'Beautiful and comfortable'],
];

async function seed() {
  await pool.query(
    "INSERT INTO Products (productID, productName, category) VALUES (1, 'Test Product', 'Dresses')"
  );
  for (const [date, label, text] of SEED) {
    const [result] = await pool.query(
      'INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES (1, ?, ?, ?)',
      ['Tester', text, date]
    );
    await pool.query(
      'INSERT INTO SentimentResults (reviewID, sentimentLabel, confidenceScore, dateProcessed) VALUES (?, ?, ?, NOW())',
      [result.insertId, label, 0.9]
    );
  }
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash(config.manager.password, 10);
});

beforeEach(async () => {
  await reset();
  await seed();
  await pool.query('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)', [
    config.manager.username,
    passwordHash,
    'manager',
  ]);

  agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .send({ username: config.manager.username, password: config.manager.password })
    .expect(200);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/stats/summary', () => {
  test('reports totals, processed and pending counts', async () => {
    const res = await agent.get('/api/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 4,
      processed: 4,
      pending: 0,
      happy: 2,
      angry: 1,
      neutral: 1,
    });
  });
});

describe('GET /api/stats/distribution', () => {
  test('counts each sentiment label', async () => {
    const res = await agent.get('/api/stats/distribution');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ Happy: 2, Angry: 1, Neutral: 1, total: 4 });
  });
});

describe('GET /api/stats/trend', () => {
  test('day interval zero-fills every day in the range', async () => {
    const res = await agent.get('/api/stats/trend?interval=day&from=2026-08-04&to=2026-08-06');
    expect(res.status).toBe(200);
    expect(res.body.interval).toBe('day');
    expect(res.body.points.map((point) => point.period)).toEqual([
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
    ]);

    const empty = res.body.points.find((point) => point.period === '2026-08-04');
    expect(empty).toEqual({ period: '2026-08-04', Happy: 0, Angry: 0, Neutral: 0 });

    const busy = res.body.points.find((point) => point.period === '2026-08-05');
    expect(busy).toMatchObject({ Happy: 1, Angry: 1, Neutral: 0 });
  });

  test('week interval buckets by Monday and zero-fills empty weeks', async () => {
    const res = await agent.get('/api/stats/trend?interval=week&from=2026-08-03&to=2026-08-23');
    expect(res.status).toBe(200);

    const periods = res.body.points.map((point) => point.period);
    expect(periods).toEqual(['2026-08-03', '2026-08-10', '2026-08-17']);

    expect(res.body.points[0]).toMatchObject({ Happy: 1, Angry: 1, Neutral: 1 });
    expect(res.body.points[1]).toMatchObject({ Happy: 1, Angry: 0, Neutral: 0 });
    expect(res.body.points[2]).toMatchObject({ Happy: 0, Angry: 0, Neutral: 0 });
  });

  test('rejects an inverted date range', async () => {
    const res = await agent.get('/api/stats/trend?from=2026-09-01&to=2026-08-01');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before|on or before/i);
  });

  test('rejects an unknown interval', async () => {
    const res = await agent.get('/api/stats/trend?interval=year');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/stats/keywords', () => {
  test('extracts keywords from angry reviews with their counts', async () => {
    const res = await agent.get('/api/stats/keywords?limit=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const words = res.body.map((item) => item.word);
    expect(words).toContain('zipper');
    expect(words).toContain('fabric');
    expect(res.body.find((item) => item.word === 'zipper')).toEqual({ word: 'zipper', count: 1 });
  });

  test('respects the limit parameter', async () => {
    const res = await agent.get('/api/stats/keywords?limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/stats/products', () => {
  test('ranks products by angry share and applies the review threshold', async () => {
    await pool.query(
      "INSERT INTO Products (productID, productName, category) VALUES (2, 'Zipper Dress', 'Dresses')"
    );
    for (const label of ['Angry', 'Happy']) {
      const [result] = await pool.query(
        'INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES (2, ?, ?, ?)',
        ['Tester', 'review for ' + label, '2026-08-07 10:00:00']
      );
      await pool.query(
        'INSERT INTO SentimentResults (reviewID, sentimentLabel, confidenceScore, dateProcessed) VALUES (?, ?, ?, NOW())',
        [result.insertId, label, 0.8]
      );
    }

    const res = await agent.get('/api/stats/products?minReviews=0');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0]).toMatchObject({
      productName: 'Zipper Dress',
      category: 'Dresses',
      total: 2,
      happy: 1,
      angry: 1,
      neutral: 0,
    });
    expect(res.body[0].angryShare).toBeCloseTo(0.5);

    expect(res.body[1]).toMatchObject({ productName: 'Test Product', total: 4, angry: 1 });
    expect(res.body[1].angryShare).toBeCloseTo(0.25);

    const thresholded = await agent.get('/api/stats/products');
    expect(thresholded.status).toBe(200);
    expect(thresholded.body).toEqual([]);
  });
});

describe('POST /api/engine/run', () => {
  test('returns a processed count', async () => {
    const res = await agent.post('/api/engine/run');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('processed');
    expect(res.body.processed).toBe(0);
  });
});

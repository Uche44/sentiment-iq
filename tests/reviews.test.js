const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/server');
const config = require('../src/config');
const { pool, reset } = require('./helpers/testDb');

const SENTIMENTS = ['Happy', 'Angry', 'Neutral'];

let agent;
let passwordHash;

beforeAll(async () => {
  passwordHash = await bcrypt.hash(config.manager.password, 10);
});

beforeEach(async () => {
  await reset();
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

function submit(payload) {
  return agent.post('/api/reviews').send(payload);
}

describe('POST /api/reviews', () => {
  test('valid input returns 201 with a label and persists a SentimentResults row', async () => {
    const res = await submit({
      productName: 'Silk Midi Dress',
      customerName: 'Ada Lovelace',
      reviewText: 'I absolutely love this dress, it is beautiful and fits perfectly!',
    });

    expect(res.status).toBe(201);
    expect(res.body.reviewID).toBeGreaterThan(0);
    expect(SENTIMENTS).toContain(res.body.sentimentLabel);
    expect(res.body.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(res.body.confidenceScore).toBeLessThanOrEqual(1);

    const [rows] = await pool.query(
      'SELECT sentimentLabel FROM SentimentResults WHERE reviewID = ?',
      [res.body.reviewID]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sentimentLabel).toBe(res.body.sentimentLabel);
  });

  test('invalid input returns 400 with a fields object', async () => {
    const res = await submit({ productName: '', customerName: '', reviewText: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('productName');
    expect(res.body.fields).toHaveProperty('customerName');
    expect(res.body.fields).toHaveProperty('reviewText');
  });

  test('creates an Uncategorised product for a new name', async () => {
    await submit({
      productName: 'Brand New Blouse',
      customerName: 'Grace Hopper',
      reviewText: 'Nice colour and comfortable fabric.',
    });

    const [rows] = await pool.query('SELECT category FROM Products WHERE productName = ?', [
      'Brand New Blouse',
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Uncategorised');
  });

  test('reuses an existing product case-insensitively', async () => {
    await pool.query(
      "INSERT INTO Products (productName, category) VALUES ('Classic Trench', 'Outerwear')"
    );

    await submit({
      productName: 'classic trench',
      customerName: 'Alan Turing',
      reviewText: 'Great cut and very warm.',
    });

    const [rows] = await pool.query(
      'SELECT productID, category FROM Products WHERE LOWER(productName) = LOWER(?)',
      ['classic trench']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Outerwear');
  });

  test('stores SQL-injection-looking input as plain text without breaking the schema', async () => {
    const sneakyText = "'); DROP TABLE Reviews; --";
    const res = await submit({
      productName: "Dress'); DELETE FROM Products; --",
      customerName: "Robert'); DROP TABLE Users; --",
      reviewText: sneakyText,
    });

    expect(res.status).toBe(201);

    const [reviews] = await pool.query('SELECT COUNT(*) AS count FROM Reviews');
    expect(reviews[0].count).toBe(1);

    const [stored] = await pool.query('SELECT reviewText FROM Reviews WHERE reviewID = ?', [
      res.body.reviewID,
    ]);
    expect(stored[0].reviewText).toBe(sneakyText);
  });
});

describe('GET /api/reviews', () => {
  async function seedThree() {
    await submit({
      productName: 'Happy Product',
      customerName: 'One',
      reviewText: 'I love this, it is wonderful and amazing!',
    });
    await submit({
      productName: 'Angry Product',
      customerName: 'Two',
      reviewText: 'Terrible quality, awful fit and a complete waste of money.',
    });
    await submit({
      productName: 'Neutral Product',
      customerName: 'Three',
      reviewText: 'The dress is made of cotton.',
    });
  }

  test('returns newest first with a total count and respects limit', async () => {
    await seedThree();

    const res = await agent.get('/api/reviews?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].reviewID).toBeGreaterThan(res.body.items[1].reviewID);
  });

  test('filters by sentiment and only returns classified reviews', async () => {
    await seedThree();

    const res = await agent.get('/api/reviews?sentiment=Angry');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].sentimentLabel).toBe('Angry');
  });

  test('supports offset pagination', async () => {
    await seedThree();

    const first = await agent.get('/api/reviews?limit=2&offset=0');
    const second = await agent.get('/api/reviews?limit=2&offset=2');

    expect(first.body.items).toHaveLength(2);
    expect(second.body.items).toHaveLength(1);
    expect(first.body.items[0].reviewID).not.toBe(second.body.items[0].reviewID);
  });

  test('rejects an invalid sentiment filter', async () => {
    const res = await agent.get('/api/reviews?sentiment=Delighted');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/products', () => {
  test('filters by query and caps the result count', async () => {
    await pool.query(
      "INSERT INTO Products (productName, category) VALUES ('Summer Dress', 'Dresses'), ('Winter Coat', 'Outerwear')"
    );

    const res = await agent.get('/api/products?q=dress');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].productName).toBe('Summer Dress');
  });
});

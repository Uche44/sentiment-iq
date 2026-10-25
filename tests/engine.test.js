const { pool, reset } = require('./helpers/testDb');
const { runOnce } = require('../src/engine/processor');

beforeEach(async () => {
  await reset();
});

afterAll(async () => {
  await pool.end();
});

async function seedReviews() {
  await pool.query(
    "INSERT INTO Products (productID, productName, category) VALUES (1, 'Test Product', 'Dresses')"
  );
  await pool.query(
    `INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES
       (1, 'Ada', 'I love this, it is amazing and beautiful!', NOW()),
       (1, 'Bola', 'Terrible, awful quality. Complete waste of money.', NOW()),
       (1, 'Chidi', 'The dress is made of cotton.', NOW())`
  );
}

describe('engine runOnce', () => {
  test('classifies the whole backlog then reports zero on a second run', async () => {
    await seedReviews();

    const processed = await runOnce();
    expect(processed).toBe(3);

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM SentimentResults');
    expect(count).toBe(3);

    const again = await runOnce();
    expect(again).toBe(0);
  });

  test('stores the expected labels', async () => {
    await seedReviews();
    await runOnce();

    const [rows] = await pool.query(
      'SELECT sentimentLabel AS label FROM SentimentResults ORDER BY reviewID'
    );
    expect(rows.map((r) => r.label)).toEqual(['Happy', 'Angry', 'Neutral']);
  });

  test('leaves already-processed reviews alone', async () => {
    await seedReviews();
    await runOnce();
    await pool.query(
      "INSERT INTO Reviews (productID, customerName, reviewText, dateSubmitted) VALUES (1, 'Dele', 'Good product overall', NOW())"
    );

    const processed = await runOnce();
    expect(processed).toBe(1);

    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM SentimentResults');
    expect(count).toBe(4);
  });
});

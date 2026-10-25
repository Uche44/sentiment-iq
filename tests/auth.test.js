const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/server');
const config = require('../src/config');
const { pool, reset } = require('./helpers/testDb');

beforeAll(async () => {
  await reset();
  const hash = await bcrypt.hash(config.manager.password, 10);
  await pool.query('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)', [
    config.manager.username,
    hash,
    'manager',
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/auth/login', () => {
  test('valid credentials return the user and set an httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: config.manager.username, password: config.manager.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: config.manager.username, role: 'manager' });

    const cookie = (res.headers['set-cookie'] || []).join('; ');
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  test('wrong password returns 401 with a generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: config.manager.username, password: 'not-the-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid username or password' });
  });

  test('unknown username returns the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid username or password');
  });

  test('missing fields return 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
  });
});

describe('route protection', () => {
  test('protected API without a cookie returns 401 JSON', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  test('unknown /api route without a cookie returns 401 before 404', async () => {
    const res = await request(app).get('/api/stats/summary');
    expect(res.status).toBe(401);
  });

  test('/dashboard without a cookie redirects to /login', async () => {
    const res = await request(app).get('/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('authenticated request reaches the API', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: config.manager.username, password: config.manager.password });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      username: config.manager.username,
      role: 'manager',
      companyName: config.companyName,
    });

    const reviews = await agent.get('/api/reviews');
    expect(reviews.status).toBe(200);
    expect(reviews.body.items).toEqual([]);
  });
});

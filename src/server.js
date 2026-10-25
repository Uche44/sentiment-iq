const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const requireAuth = require('./middleware/requireAuth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const reviewRoutes = require('./routes/reviews');
const statsRoutes = require('./routes/stats');
const engine = require('./engine/processor');

const app = express();
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use(express.json());
app.use(cookieParser());

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendDir, 'login.html'));
});

app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use('/vendor', express.static(path.join(frontendDir, 'vendor')));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/engine', statsRoutes.engineRouter);

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(frontendDir, 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });
  engine.start();
}

module.exports = app;

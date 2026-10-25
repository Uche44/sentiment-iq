const jwt = require('jsonwebtoken');
const config = require('../config');

function unauthorised(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/login');
}

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) return unauthorised(req, res);

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch (err) {
    return unauthorised(req, res);
  }
}

module.exports = requireAuth;
module.exports.unauthorised = unauthorised;

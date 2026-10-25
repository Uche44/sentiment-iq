function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}: ${err.message}`);
  }

  const body = { error: message };
  if (err.fields) body.fields = err.fields;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };

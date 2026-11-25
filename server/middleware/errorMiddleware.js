const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  logger.error(`${req.method} ${req.originalUrl} -> ${err.message}`);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Uploaded file exceeds the 5 MB size limit.',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(err.alternatives ? { alternatives: err.alternatives } : {}),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

const logger = {
  info(message, meta) {
    const ts = new Date().toISOString();
    if (meta !== undefined) {
      console.log(`[${ts}] [INFO] ${message}`, meta);
    } else {
      console.log(`[${ts}] [INFO] ${message}`);
    }
  },
  warn(message, meta) {
    const ts = new Date().toISOString();
    if (meta !== undefined) {
      console.warn(`[${ts}] [WARN] ${message}`, meta);
    } else {
      console.warn(`[${ts}] [WARN] ${message}`);
    }
  },
  error(message, meta) {
    const ts = new Date().toISOString();
    if (meta !== undefined) {
      console.error(`[${ts}] [ERROR] ${message}`, meta);
    } else {
      console.error(`[${ts}] [ERROR] ${message}`);
    }
  },
  requestLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${ms}ms)`);
    });
    next();
  },
};

module.exports = logger;

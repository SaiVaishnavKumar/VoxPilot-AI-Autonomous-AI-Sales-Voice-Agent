const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/database');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication token required.' });
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await db.users.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid session user.' });
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}

module.exports = { requireAuth };

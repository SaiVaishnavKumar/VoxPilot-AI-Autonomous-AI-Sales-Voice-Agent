const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const env = require('../config/env');

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company || env.companyName,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, company } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const existing = await db.users.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.users.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: 'agent',
      company: company || env.companyName,
    });

    const token = signToken(user);
    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    success: true,
    user: req.user,
  });
}

module.exports = {
  register,
  login,
  me,
};

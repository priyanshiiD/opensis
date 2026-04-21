const jwt = require('jsonwebtoken');

const signAccess = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_TTL || '15m' });

const signRefresh = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_TTL || '7d' });

module.exports = { signAccess, signRefresh };

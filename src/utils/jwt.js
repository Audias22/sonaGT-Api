// Funciones para generar y verificar tokens JWT
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(user) {
  const payload = { sub: String(user.id), role: user.role, plan: user.plan };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

function signRefreshToken(user) {
  // jti (id único) evita que dos tokens emitidos en el mismo segundo sean idénticos
  const payload = { sub: String(user.id), jti: crypto.randomUUID() };
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, { algorithms: ['HS256'] });
}

// Hash SHA-256 del refresh token: en la base de datos nunca se guarda el token
// real, así una fuga de la BD no permite usar las sesiones robadas
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};

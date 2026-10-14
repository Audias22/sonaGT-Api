// Limita los intentos de login para frenar ataques de fuerza bruta
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { logEvent } = require('../services/audit.service');
const { getRequestContext } = require('../utils/requestContext');

const { max, windowMinutes } = config.loginRateLimit;

const loginLimiter = rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit: max, // 5 intentos por IP por defecto (LOGIN_RATE_LIMIT_MAX en .env)
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Se audita el bloqueo y se envía al middleware global de errores para
  // mantener el mismo formato de respuesta
  handler: async (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.slice(0, 254) : null;
    await logEvent('RATE_LIMIT_EXCEEDED', {
      context: getRequestContext(req),
      details: { route: req.originalUrl, email },
    });
    next(
      new AppError(
        `Demasiados intentos de inicio de sesión, intenta de nuevo en ${windowMinutes} minutos`,
        429
      )
    );
  },
});

module.exports = { loginLimiter };

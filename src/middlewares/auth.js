// Verifica el access token enviado en "Authorization: Bearer <token>"
const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Token no proporcionado', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { ...payload, id: Number(payload.sub) };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401));
    }
    next(new AppError('Token inválido', 401));
  }
}

module.exports = authenticate;

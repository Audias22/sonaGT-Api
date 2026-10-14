// Restringe una ruta a ciertos roles. Uso: authorize('ADMIN', 'ARTISTA')
// Debe ir DESPUÉS del middleware authenticate
const AppError = require('../utils/AppError');

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('No tienes permiso para realizar esta acción', 403));
    }
    next();
  };
}

module.exports = authorize;

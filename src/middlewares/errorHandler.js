// Middleware global de errores
// Siempre responde con el formato: { success: false, message, errors }
function errorHandler(err, req, res, next) {
  // JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'El cuerpo de la petición no es un JSON válido',
      errors: [],
    });
  }

  const statusCode = err.statusCode || 500;

  // En errores 500 no se expone el detalle interno al cliente
  if (statusCode >= 500) {
    console.error(err);
    return res.status(statusCode).json({
      success: false,
      message: 'Error interno del servidor',
      errors: [],
    });
  }

  // Por ejemplo, el límite de saltos indica cuándo se puede volver a intentar
  if (err.retryAfterSeconds) {
    res.set('Retry-After', String(err.retryAfterSeconds));
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    errors: err.errors || [],
  });
}

module.exports = errorHandler;

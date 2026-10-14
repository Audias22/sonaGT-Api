// Middleware genérico: valida una parte de la petición con un esquema de zod
// Uso: validate(schema)            -> valida req.body
//      validate(schema, 'params')  -> valida req.params
//      validate(schema, 'query')   -> valida req.query
const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] || {});

    if (!result.success) {
      // Indica qué campo falló y por qué
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Error de validación', 400, errors));
    }

    // Se reemplazan los datos por los ya validados y convertidos (por ejemplo
    // "5" -> 5). En Express 5 req.query es de solo lectura, por eso se redefine
    // la propiedad en lugar de asignarla directamente
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

module.exports = validate;

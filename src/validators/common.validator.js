// Esquemas reutilizables: ids en la URL, paginación y campos comunes
const { z } = require('zod');

// Id numérico que llega como texto en la URL (por eso se usa coerce)
function positiveIdParam(label) {
  const message = `${label} debe ser un número entero positivo`;
  return z.coerce.number({ error: message }).int(message).positive(message);
}

const idParamSchema = z.object({ id: positiveIdParam('El id') });

// ?page=1&limit=10 (máximo 50 por página)
const paginationSchema = z.object({
  page: z.coerce
    .number({ error: 'page debe ser un número' })
    .int('page debe ser un número entero')
    .positive('page debe ser mayor a 0')
    .default(1),
  limit: z.coerce
    .number({ error: 'limit debe ser un número' })
    .int('limit debe ser un número entero')
    .positive('limit debe ser mayor a 0')
    .max(50, 'limit no puede ser mayor a 50')
    .default(10),
});

// Texto de búsqueda opcional (?q=)
const searchText = z.string().trim().min(1, 'La búsqueda no puede estar vacía').max(100).optional();

// Género musical: se guarda siempre en minúsculas para que el filtro sea consistente
const genre = z
  .string({ error: 'El género debe ser texto' })
  .trim()
  .toLowerCase()
  .min(2, 'El género debe tener al menos 2 caracteres')
  .max(30, 'El género no puede tener más de 30 caracteres');

// Solo se aceptan URLs http/https (evita valores como "javascript:...")
const httpUrl = z.url({ protocol: /^https?$/, error: 'Debe ser una URL http(s) válida' });

// Exige que un PATCH traiga al menos un campo
function requireAtLeastOneField(schema) {
  return schema.refine((data) => Object.keys(data).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });
}

module.exports = {
  positiveIdParam,
  idParamSchema,
  paginationSchema,
  searchText,
  genre,
  httpUrl,
  requireAtLeastOneField,
};

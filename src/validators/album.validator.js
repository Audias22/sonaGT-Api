// Esquemas de validación (zod) para álbumes
const { z } = require('zod');
const { httpUrl, requireAtLeastOneField } = require('./common.validator');

const MAX_YEAR = new Date().getFullYear() + 1;

// artistId NO está en el esquema: zod descarta los campos desconocidos, así
// que aunque el cliente lo envíe se ignora y se usa el perfil del token
const albumFields = z.object({
  title: z
    .string({ error: 'El título es requerido' })
    .trim()
    .min(1, 'El título es requerido')
    .max(100, 'El título no puede tener más de 100 caracteres'),
  releaseYear: z
    .number({ error: 'El año de lanzamiento debe ser un número' })
    .int('El año de lanzamiento debe ser un número entero')
    .min(1900, 'El año de lanzamiento no puede ser menor a 1900')
    .max(MAX_YEAR, `El año de lanzamiento no puede ser mayor a ${MAX_YEAR}`),
  coverUrl: httpUrl.optional(),
});

const createAlbumSchema = albumFields;

const updateAlbumSchema = requireAtLeastOneField(albumFields.partial());

module.exports = { createAlbumSchema, updateAlbumSchema };

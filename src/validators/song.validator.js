// Esquemas de validación (zod) para canciones
const { z } = require('zod');
const {
  paginationSchema,
  searchText,
  genre,
  httpUrl,
  requireAtLeastOneField,
} = require('./common.validator');

const albumId = z
  .number({ error: 'albumId debe ser un número' })
  .int('albumId debe ser un número entero')
  .positive('albumId debe ser un número positivo');

// artistId y plays NO están en el esquema: el artista sale del token y
// las reproducciones no se pueden modificar a mano
const songFields = z.object({
  title: z
    .string({ error: 'El título es requerido' })
    .trim()
    .min(1, 'El título es requerido')
    .max(100, 'El título no puede tener más de 100 caracteres'),
  durationSec: z
    .number({ error: 'La duración debe ser un número' })
    .int('La duración debe ser un número entero de segundos')
    .positive('La duración debe ser mayor a 0')
    .max(3600, 'La duración no puede ser mayor a 3600 segundos'),
  genre: genre.optional(),
  audioUrl: httpUrl,
  albumId: albumId.optional(),
});

const createSongSchema = songFields;

// En la edición, albumId puede ser null para sacar la canción del álbum
const updateSongSchema = requireAtLeastOneField(
  songFields.extend({ albumId: albumId.nullable() }).partial()
);

// GET /songs?page=&limit=&q=&genre=&artistId=&sort=popular
const listSongsQuerySchema = paginationSchema.extend({
  q: searchText,
  genre: genre.optional(),
  artistId: z.coerce
    .number({ error: 'artistId debe ser un número' })
    .int('artistId debe ser un número entero')
    .positive('artistId debe ser un número positivo')
    .optional(),
  sort: z.enum(['popular'], { error: 'sort solo puede ser "popular"' }).optional(),
});

module.exports = { createSongSchema, updateSongSchema, listSongsQuerySchema };

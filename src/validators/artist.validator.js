// Esquemas de validación (zod) para artistas
const { z } = require('zod');
const {
  paginationSchema,
  searchText,
  genre,
  requireAtLeastOneField,
} = require('./common.validator');

// GET /artists?page=&limit=&q=&genre=
const listArtistsQuerySchema = paginationSchema.extend({
  q: searchText,
  genre: genre.optional(),
});

// PATCH /artists/me (solo bio y género)
const updateMyArtistSchema = requireAtLeastOneField(
  z.object({
    bio: z
      .string({ error: 'La bio debe ser texto' })
      .trim()
      .max(500, 'La bio no puede tener más de 500 caracteres')
      .optional(),
    genre: genre.optional(),
  })
);

module.exports = { listArtistsQuerySchema, updateMyArtistSchema };

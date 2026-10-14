// Esquemas de validación (zod) para playlists
const { z } = require('zod');
const { positiveIdParam, requireAtLeastOneField } = require('./common.validator');

const playlistFields = z.object({
  name: z
    .string({ error: 'El nombre es requerido' })
    .trim()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede tener más de 100 caracteres'),
  isPublic: z.boolean({ error: 'isPublic debe ser true o false' }).default(false),
});

const createPlaylistSchema = playlistFields;

// En la edición no se aplica el valor por defecto de isPublic
const updatePlaylistSchema = requireAtLeastOneField(
  playlistFields.extend({ isPublic: z.boolean({ error: 'isPublic debe ser true o false' }) }).partial()
);

// POST /playlists/:id/songs
const addSongSchema = z.object({
  songId: z
    .number({ error: 'songId debe ser un número' })
    .int('songId debe ser un número entero')
    .positive('songId debe ser un número positivo'),
});

// DELETE /playlists/:id/songs/:songId
const playlistSongParamsSchema = z.object({
  id: positiveIdParam('El id'),
  songId: positiveIdParam('El songId'),
});

module.exports = {
  createPlaylistSchema,
  updatePlaylistSchema,
  addSongSchema,
  playlistSongParamsSchema,
};

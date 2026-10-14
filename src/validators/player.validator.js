// Esquemas de validación (zod) para el reproductor
const { z } = require('zod');
const { positiveIdParam } = require('./common.validator');

// POST /player/play/:songId y /player/skip/:songId
const songIdParamSchema = z.object({ songId: positiveIdParam('El songId') });

module.exports = { songIdParamSchema };

// Rutas de canciones (/api/v1/songs)
const { Router } = require('express');
const songController = require('../controllers/song.controller');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { idParamSchema } = require('../validators/common.validator');
const {
  createSongSchema,
  updateSongSchema,
  listSongsQuerySchema,
} = require('../validators/song.validator');

const router = Router();

// Todo el catálogo requiere estar autenticado (cualquier rol)
router.use(authenticate);

router.get('/', validate(listSongsQuerySchema, 'query'), songController.list);
router.get('/:id', validate(idParamSchema, 'params'), songController.getById);
router.post('/', authorize('ARTISTA'), validate(createSongSchema), songController.create);
router.patch(
  '/:id',
  authorize('ARTISTA'),
  validate(idParamSchema, 'params'),
  validate(updateSongSchema),
  songController.update
);
router.delete(
  '/:id',
  authorize('ARTISTA', 'ADMIN'),
  validate(idParamSchema, 'params'),
  songController.remove
);

module.exports = router;

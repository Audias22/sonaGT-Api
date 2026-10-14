// Rutas de álbumes (/api/v1/albums)
const { Router } = require('express');
const albumController = require('../controllers/album.controller');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { idParamSchema } = require('../validators/common.validator');
const { createAlbumSchema, updateAlbumSchema } = require('../validators/album.validator');

const router = Router();

// Todo el catálogo requiere estar autenticado (cualquier rol)
router.use(authenticate);

router.get('/:id', validate(idParamSchema, 'params'), albumController.getById);
router.post('/', authorize('ARTISTA'), validate(createAlbumSchema), albumController.create);
router.patch(
  '/:id',
  authorize('ARTISTA'),
  validate(idParamSchema, 'params'),
  validate(updateAlbumSchema),
  albumController.update
);
router.delete(
  '/:id',
  authorize('ARTISTA', 'ADMIN'),
  validate(idParamSchema, 'params'),
  albumController.remove
);

module.exports = router;

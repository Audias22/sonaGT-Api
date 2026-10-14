// Rutas de artistas (/api/v1/artists)
const { Router } = require('express');
const artistController = require('../controllers/artist.controller');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { idParamSchema } = require('../validators/common.validator');
const {
  listArtistsQuerySchema,
  updateMyArtistSchema,
} = require('../validators/artist.validator');

const router = Router();

// Todo el catálogo requiere estar autenticado (cualquier rol)
router.use(authenticate);

router.get('/', validate(listArtistsQuerySchema, 'query'), artistController.list);
router.patch(
  '/me',
  authorize('ARTISTA'),
  validate(updateMyArtistSchema),
  artistController.updateMe
);
router.get('/:id', validate(idParamSchema, 'params'), artistController.getById);

module.exports = router;

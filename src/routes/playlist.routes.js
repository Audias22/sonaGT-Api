// Rutas de playlists (/api/v1/playlists)
const { Router } = require('express');
const playlistController = require('../controllers/playlist.controller');
const authenticate = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { idParamSchema, paginationSchema } = require('../validators/common.validator');
const {
  createPlaylistSchema,
  updatePlaylistSchema,
  addSongSchema,
  playlistSongParamsSchema,
} = require('../validators/playlist.validator');

const router = Router();

router.use(authenticate);

router.get('/me', validate(paginationSchema, 'query'), playlistController.listMine);
router.get('/:id', validate(idParamSchema, 'params'), playlistController.getById);
// El límite de playlists del plan FREE se verifica en el servicio, dentro de
// una transacción (ver utils/planLimits.js)
router.post('/', validate(createPlaylistSchema), playlistController.create);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updatePlaylistSchema),
  playlistController.update
);
router.delete('/:id', validate(idParamSchema, 'params'), playlistController.remove);

router.post(
  '/:id/songs',
  validate(idParamSchema, 'params'),
  validate(addSongSchema),
  playlistController.addSong
);
router.delete(
  '/:id/songs/:songId',
  validate(playlistSongParamsSchema, 'params'),
  playlistController.removeSong
);

module.exports = router;

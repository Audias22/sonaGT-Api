// Rutas del reproductor (/api/v1/player)
const { Router } = require('express');
const playerController = require('../controllers/player.controller');
const authenticate = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { paginationSchema } = require('../validators/common.validator');
const { songIdParamSchema } = require('../validators/player.validator');

const router = Router();

router.use(authenticate);

router.post('/play/:songId', validate(songIdParamSchema, 'params'), playerController.play);
// El límite de saltos del plan FREE se verifica en el servicio, dentro de
// una transacción (ver utils/planLimits.js)
router.post('/skip/:songId', validate(songIdParamSchema, 'params'), playerController.skip);
router.get('/history', validate(paginationSchema, 'query'), playerController.history);

module.exports = router;

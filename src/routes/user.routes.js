// Rutas del usuario autenticado (/api/v1/users)
const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { changePlanSchema } = require('../validators/user.validator');

const router = Router();

router.use(authenticate);

router.patch('/me/plan', validate(changePlanSchema), userController.changePlan);

module.exports = router;

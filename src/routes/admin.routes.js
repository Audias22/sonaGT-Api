// Rutas de administración (/api/v1/admin), solo ADMIN
const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/roles');
const validate = require('../middlewares/validate');
const { idParamSchema } = require('../validators/common.validator');
const {
  listUsersQuerySchema,
  changeRoleSchema,
  listAuditLogsQuerySchema,
} = require('../validators/user.validator');

const router = Router();

// Todas las rutas de este router exigen estar autenticado y ser ADMIN
router.use(authenticate, authorize('ADMIN'));

router.get('/users', validate(listUsersQuerySchema, 'query'), adminController.listUsers);
router.patch(
  '/users/:id/role',
  validate(idParamSchema, 'params'),
  validate(changeRoleSchema),
  adminController.changeRole
);
router.get('/stats', adminController.stats);
router.get(
  '/audit-logs',
  validate(listAuditLogsQuerySchema, 'query'),
  adminController.auditLogs
);

module.exports = router;

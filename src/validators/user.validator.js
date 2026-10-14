// Esquemas de validación (zod) para usuarios y administración
const { z } = require('zod');
const { paginationSchema, positiveIdParam } = require('./common.validator');

const ROLES = ['OYENTE', 'ARTISTA', 'ADMIN'];

// PATCH /users/me/plan
const changePlanSchema = z.object({
  plan: z.enum(['FREE', 'PREMIUM'], { error: 'El plan solo puede ser FREE o PREMIUM' }),
});

// GET /admin/users?page=&limit=&role=
const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES, { error: 'El rol solo puede ser OYENTE, ARTISTA o ADMIN' }).optional(),
});

// PATCH /admin/users/:id/role
const changeRoleSchema = z.object({
  role: z.enum(ROLES, { error: 'El rol solo puede ser OYENTE, ARTISTA o ADMIN' }),
});

const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'TOKEN_REUSE_DETECTED',
  'LOGOUT',
  'PLAN_CHANGED',
  'ROLE_CHANGED',
  'RESOURCE_DELETED',
  'RATE_LIMIT_EXCEEDED',
];

// GET /admin/audit-logs?page=&limit=&action=&userId=
const listAuditLogsQuerySchema = paginationSchema.extend({
  action: z.enum(AUDIT_ACTIONS, { error: 'La acción no es válida' }).optional(),
  userId: positiveIdParam('El userId').optional(),
});

module.exports = {
  changePlanSchema,
  listUsersQuerySchema,
  changeRoleSchema,
  listAuditLogsQuerySchema,
};

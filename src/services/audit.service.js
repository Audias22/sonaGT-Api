// Registro de auditoría (bitácora de eventos de seguridad)
const prisma = require('../config/prisma');
const { paginate, buildMeta } = require('../utils/pagination');

// Registra un evento. Si el guardado falla, NO interrumpe la petición:
// solo deja el error en consola.
// - action: uno de los valores del enum AuditAction (ver schema.prisma)
// - userId: usuario que realizó la acción (opcional)
// - context: { ip, userAgent } obtenido con getRequestContext(req)
// - details: objeto con datos adicionales (nunca contraseñas ni tokens)
async function logEvent(action, { userId = null, context = {}, details = null } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        ip: context.ip || null,
        userAgent: context.userAgent || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    console.error(`[auditoría] No se pudo registrar el evento ${action}: ${err.message}`);
  }
}

// details se guarda como texto JSON; al listar se devuelve como objeto
function parseDetails(details) {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return details;
  }
}

async function listLogs({ page, limit, action, userId }) {
  const where = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...paginate({ page, limit }),
    }),
  ]);

  return {
    data: logs.map((log) => ({ ...log, details: parseDetails(log.details) })),
    meta: buildMeta({ page, limit }, total),
  };
}

module.exports = { logEvent, listLogs };

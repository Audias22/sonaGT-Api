// Lógica de negocio del usuario autenticado
const prisma = require('../config/prisma');
const { createTokenPair, revokeAllSessions } = require('./auth.service');
const { logEvent } = require('./audit.service');

// Simula el cambio de plan (sin pago real).
// Como el plan viaja dentro del JWT, se revocan las sesiones anteriores y se
// entrega un par nuevo de tokens que ya contiene el plan actualizado
async function changePlan(userId, plan, context) {
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const user = await prisma.user.update({ where: { id: userId }, data: { plan } });
  await revokeAllSessions(userId);
  const tokens = await createTokenPair(user);

  await logEvent('PLAN_CHANGED', { userId, context, details: { from: before.plan, to: plan } });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan },
    ...tokens,
  };
}

module.exports = { changePlan };

// Lógica de negocio de administración
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paginate, buildMeta } = require('../utils/pagination');
const { revokeAllSessions } = require('./auth.service');
const { logEvent } = require('./audit.service');

// Campos de usuario visibles para el admin (nunca la contraseña)
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  plan: true,
  createdAt: true,
};

async function listUsers({ page, limit, role }) {
  const where = role ? { role } : {};
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: userSelect, orderBy: { id: 'asc' }, ...paginate({ page, limit }) }),
  ]);
  return { data: users, meta: buildMeta({ page, limit }, total) };
}

async function changeRole(targetId, adminId, role, context) {
  // Evita que el sistema se quede sin el admin que hace el cambio
  if (targetId === adminId && role !== 'ADMIN') {
    throw new AppError('No puedes quitarte a ti mismo el rol ADMIN', 400);
  }

  const user = await prisma.user.findUnique({ where: { id: targetId }, include: { artist: true } });
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const data = { role };
  // Si pasa a ARTISTA y no tiene perfil, se le crea uno con su nombre
  if (role === 'ARTISTA' && !user.artist) {
    data.artist = { create: { name: user.name } };
  }

  const updated = await prisma.user.update({ where: { id: targetId }, data, select: userSelect });

  // El rol viaja en el JWT: se cierran sus sesiones para que vuelva a iniciar
  // sesión y reciba un token con el rol nuevo
  await revokeAllSessions(targetId);

  // userId es quién hizo el cambio; details indica a quién y qué cambió
  await logEvent('ROLE_CHANGED', {
    userId: adminId,
    context,
    details: { targetUserId: targetId, targetEmail: user.email, from: user.role, to: role },
  });
  return updated;
}

// Convierte el resultado de groupBy en { VALOR: cantidad }, incluyendo ceros
function countBy(groups, field, values) {
  const result = Object.fromEntries(values.map((value) => [value, 0]));
  for (const group of groups) {
    result[group[field]] = group._count._all;
  }
  return result;
}

async function getStats() {
  const [byRole, byPlan, totalUsers, totalSongs, playsSum, topSongs] = await prisma.$transaction([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true }, orderBy: { role: 'asc' } }),
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true }, orderBy: { plan: 'asc' } }),
    prisma.user.count(),
    prisma.song.count(),
    prisma.song.aggregate({ _sum: { plays: true } }),
    prisma.song.findMany({
      select: { id: true, title: true, plays: true, artist: { select: { id: true, name: true } } },
      orderBy: [{ plays: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      byRole: countBy(byRole, 'role', ['OYENTE', 'ARTISTA', 'ADMIN']),
      byPlan: countBy(byPlan, 'plan', ['FREE', 'PREMIUM']),
    },
    totalSongs,
    totalPlays: playsSum._sum.plays || 0,
    topSongs,
  };
}

module.exports = { listUsers, changeRole, getStats };

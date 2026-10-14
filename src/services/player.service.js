// Lógica de negocio del reproductor
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paginate, buildMeta } = require('../utils/pagination');
const { ONE_HOUR_MS, getPlanLimits, checkSkipLimit } = require('../utils/planLimits');

async function findSongOrFail(songId) {
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) {
    throw new AppError('Canción no encontrada', 404);
  }
  return song;
}

async function play(userId, songId) {
  await findSongOrFail(songId);

  // Transacción: o se guardan las dos operaciones o ninguna
  const [entry, song] = await prisma.$transaction([
    prisma.playHistory.create({ data: { userId, songId } }),
    prisma.song.update({
      where: { id: songId },
      data: { plays: { increment: 1 } },
      select: { id: true, title: true, plays: true },
    }),
  ]);

  return { playedAt: entry.playedAt, song };
}

// user: req.user (id y plan vienen del token)
async function skip(user, songId) {
  await findSongOrFail(songId);

  // Insertar y contar en la misma transacción (ver utils/planLimits.js)
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.playHistory.create({
      data: { userId: user.id, songId, skipped: true },
    });

    if (getPlanLimits(user.plan).maxSkipsPerHour !== Infinity) {
      const skips = await tx.playHistory.findMany({
        where: {
          userId: user.id,
          skipped: true,
          playedAt: { gte: new Date(Date.now() - ONE_HOUR_MS) },
        },
        select: { playedAt: true },
        orderBy: [{ playedAt: 'asc' }, { id: 'asc' }],
      });
      // si lanza error, se revierte el create
      checkSkipLimit(user.plan, skips.map((s) => s.playedAt));
    }
    return created;
  });

  return { skippedAt: entry.playedAt, songId };
}

async function getHistory(userId, { page, limit }) {
  const where = { userId };
  const [total, entries] = await prisma.$transaction([
    prisma.playHistory.count({ where }),
    prisma.playHistory.findMany({
      where,
      orderBy: [{ playedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        playedAt: true,
        skipped: true,
        song: {
          select: {
            id: true,
            title: true,
            durationSec: true,
            genre: true,
            artist: { select: { id: true, name: true } },
          },
        },
      },
      ...paginate({ page, limit }),
    }),
  ]);
  return { data: entries, meta: buildMeta({ page, limit }, total) };
}

module.exports = { play, skip, getHistory };

// Lógica de negocio de playlists
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paginate, buildMeta } = require('../utils/pagination');
const { getPlanLimits, checkPlaylistLimit } = require('../utils/planLimits');

const playlistSelect = { id: true, name: true, isPublic: true, userId: true };

// Busca una playlist que el usuario puede VER (pública o propia).
// Una playlist privada ajena responde 404 (no 403) para no revelar que existe
async function findVisiblePlaylistOrFail(id, userId) {
  const playlist = await prisma.playlist.findUnique({ where: { id } });
  if (!playlist || (!playlist.isPublic && playlist.userId !== userId)) {
    throw new AppError('Playlist no encontrada', 404);
  }
  return playlist;
}

// Busca una playlist que el usuario puede MODIFICAR (solo el dueño).
// Si es pública y ajena responde 403; si es privada y ajena, 404
async function findOwnPlaylistOrFail(id, userId) {
  const playlist = await findVisiblePlaylistOrFail(id, userId);
  if (playlist.userId !== userId) {
    throw new AppError('No tienes permiso para modificar esta playlist', 403);
  }
  return playlist;
}

async function listMyPlaylists(userId, { page, limit }) {
  const where = { userId };
  const [total, playlists] = await prisma.$transaction([
    prisma.playlist.count({ where }),
    prisma.playlist.findMany({
      where,
      select: { ...playlistSelect, _count: { select: { songs: true } } },
      orderBy: { id: 'asc' },
      ...paginate({ page, limit }),
    }),
  ]);
  return { data: playlists, meta: buildMeta({ page, limit }, total) };
}

async function getPlaylistById(id, userId) {
  await findVisiblePlaylistOrFail(id, userId);

  const playlist = await prisma.playlist.findUnique({
    where: { id },
    select: {
      ...playlistSelect,
      user: { select: { id: true, name: true } },
      songs: {
        orderBy: { addedAt: 'asc' },
        select: {
          addedAt: true,
          song: {
            select: {
              id: true,
              title: true,
              durationSec: true,
              genre: true,
              audioUrl: true,
              artist: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Se aplana cada elemento: { ...canción, addedAt }
  const { user, songs, ...data } = playlist;
  return {
    ...data,
    owner: user,
    songs: songs.map(({ addedAt, song }) => ({ ...song, addedAt })),
  };
}

// user: req.user (id y plan vienen del token)
async function createPlaylist(user, data) {
  // Insertar y contar en la misma transacción (ver utils/planLimits.js)
  return prisma.$transaction(async (tx) => {
    const playlist = await tx.playlist.create({
      data: { ...data, userId: user.id },
      select: playlistSelect,
    });

    if (getPlanLimits(user.plan).maxPlaylists !== Infinity) {
      const total = await tx.playlist.count({ where: { userId: user.id } });
      checkPlaylistLimit(user.plan, total); // si lanza error, se revierte el create
    }
    return playlist;
  });
}

async function updatePlaylist(id, userId, data) {
  await findOwnPlaylistOrFail(id, userId);
  return prisma.playlist.update({ where: { id }, data, select: playlistSelect });
}

async function deletePlaylist(id, userId) {
  await findOwnPlaylistOrFail(id, userId);
  await prisma.playlist.delete({ where: { id } });
}

async function addSong(playlistId, userId, songId) {
  await findOwnPlaylistOrFail(playlistId, userId);

  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) {
    throw new AppError('Canción no encontrada', 404);
  }

  const existing = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId, songId } },
  });
  if (existing) {
    throw new AppError('La canción ya está en la playlist', 409);
  }

  return prisma.playlistSong.create({ data: { playlistId, songId } });
}

async function removeSong(playlistId, userId, songId) {
  await findOwnPlaylistOrFail(playlistId, userId);

  const { count } = await prisma.playlistSong.deleteMany({ where: { playlistId, songId } });
  if (count === 0) {
    throw new AppError('La canción no está en la playlist', 404);
  }
}

module.exports = {
  listMyPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSong,
  removeSong,
};

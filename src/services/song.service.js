// Lógica de negocio de canciones
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { checkOwnership } = require('../utils/ownership');
const { paginate, buildMeta } = require('../utils/pagination');
const { getArtistProfileByUserId } = require('./artist.service');
const { logEvent } = require('./audit.service');

// Datos que se devuelven de cada canción
const songSelect = {
  id: true,
  title: true,
  durationSec: true,
  genre: true,
  audioUrl: true,
  plays: true,
  artist: { select: { id: true, name: true } },
  album: { select: { id: true, title: true, releaseYear: true, coverUrl: true } },
};

// Busca la canción (con el userId de su dueño) o responde 404
async function findSongOrFail(id) {
  const song = await prisma.song.findUnique({
    where: { id },
    include: { artist: { select: { userId: true } } },
  });
  if (!song) {
    throw new AppError('Canción no encontrada', 404);
  }
  return song;
}

// Verifica que el álbum exista (404) y pertenezca al artista (403)
async function checkAlbumBelongsToArtist(albumId, artistId) {
  const album = await prisma.album.findUnique({ where: { id: albumId } });
  if (!album) {
    throw new AppError('Álbum no encontrado', 404);
  }
  if (album.artistId !== artistId) {
    throw new AppError('El álbum no pertenece a tu perfil de artista', 403);
  }
}

async function listSongs({ page, limit, q, genre, artistId, sort }) {
  const where = {};
  if (q) where.title = { contains: q };
  if (genre) where.genre = genre;
  if (artistId) where.artistId = artistId;

  // sort=popular ordena por reproducciones; si no, por orden de creación
  const orderBy = sort === 'popular' ? [{ plays: 'desc' }, { id: 'asc' }] : { id: 'asc' };

  const [total, songs] = await prisma.$transaction([
    prisma.song.count({ where }),
    prisma.song.findMany({ where, select: songSelect, orderBy, ...paginate({ page, limit }) }),
  ]);

  return { data: songs, meta: buildMeta({ page, limit }, total) };
}

async function getSongById(id) {
  const song = await prisma.song.findUnique({ where: { id }, select: songSelect });
  if (!song) {
    throw new AppError('Canción no encontrada', 404);
  }
  return song;
}

async function createSong(userId, data) {
  // La canción siempre se asigna al perfil del artista autenticado
  const artist = await getArtistProfileByUserId(userId);
  if (data.albumId) {
    await checkAlbumBelongsToArtist(data.albumId, artist.id);
  }
  return prisma.song.create({
    data: { ...data, artistId: artist.id },
    select: songSelect,
  });
}

async function updateSong(id, user, data) {
  const song = await findSongOrFail(id);
  checkOwnership(song.artist.userId, user);
  // Si se mueve a otro álbum, ese álbum también debe ser del mismo artista
  if (data.albumId) {
    await checkAlbumBelongsToArtist(data.albumId, song.artistId);
  }
  return prisma.song.update({ where: { id }, data, select: songSelect });
}

async function deleteSong(id, user, context) {
  const song = await findSongOrFail(id);
  checkOwnership(song.artist.userId, user, { allowAdmin: true });
  await prisma.song.delete({ where: { id } });

  // Se audita cuando un ADMIN borra contenido de otro artista
  if (user.role === 'ADMIN' && song.artist.userId !== user.id) {
    await logEvent('RESOURCE_DELETED', {
      userId: user.id,
      context,
      details: { resource: 'song', id: song.id, title: song.title, artistId: song.artistId },
    });
  }
}

module.exports = { listSongs, getSongById, createSong, updateSong, deleteSong };

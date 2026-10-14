// Lógica de negocio de álbumes
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { checkOwnership } = require('../utils/ownership');
const { getArtistProfileByUserId } = require('./artist.service');
const { logEvent } = require('./audit.service');

// Busca el álbum (con el userId de su dueño) o responde 404
async function findAlbumOrFail(id) {
  const album = await prisma.album.findUnique({
    where: { id },
    include: { artist: { select: { userId: true } } },
  });
  if (!album) {
    throw new AppError('Álbum no encontrado', 404);
  }
  return album;
}

async function getAlbumById(id) {
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      artist: { select: { id: true, name: true } },
      songs: {
        select: { id: true, title: true, durationSec: true, genre: true, audioUrl: true, plays: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!album) {
    throw new AppError('Álbum no encontrado', 404);
  }
  return album;
}

async function createAlbum(userId, data) {
  // El álbum siempre se asigna al perfil del artista autenticado
  const artist = await getArtistProfileByUserId(userId);
  return prisma.album.create({ data: { ...data, artistId: artist.id } });
}

async function updateAlbum(id, user, data) {
  const album = await findAlbumOrFail(id);
  checkOwnership(album.artist.userId, user);
  return prisma.album.update({ where: { id }, data });
}

async function deleteAlbum(id, user, context) {
  const album = await findAlbumOrFail(id);
  checkOwnership(album.artist.userId, user, { allowAdmin: true });
  // Las canciones del álbum no se borran: quedan como sencillos (albumId = null)
  await prisma.album.delete({ where: { id } });

  // Se audita cuando un ADMIN borra contenido de otro artista
  if (user.role === 'ADMIN' && album.artist.userId !== user.id) {
    await logEvent('RESOURCE_DELETED', {
      userId: user.id,
      context,
      details: { resource: 'album', id: album.id, title: album.title, artistId: album.artistId },
    });
  }
}

module.exports = { getAlbumById, createAlbum, updateAlbum, deleteAlbum };

// Lógica de negocio de artistas
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paginate, buildMeta } = require('../utils/pagination');

// Campos públicos de un artista (no se expone el userId ni datos del usuario)
const artistSelect = { id: true, name: true, bio: true, genre: true };

async function listArtists({ page, limit, q, genre }) {
  const where = {};
  if (q) where.name = { contains: q };
  if (genre) where.genre = genre;

  const [total, artists] = await prisma.$transaction([
    prisma.artist.count({ where }),
    prisma.artist.findMany({
      where,
      select: { ...artistSelect, _count: { select: { albums: true, songs: true } } },
      orderBy: { name: 'asc' },
      ...paginate({ page, limit }),
    }),
  ]);

  return { data: artists, meta: buildMeta({ page, limit }, total) };
}

async function getArtistById(id) {
  const artist = await prisma.artist.findUnique({
    where: { id },
    select: {
      ...artistSelect,
      albums: {
        select: { id: true, title: true, releaseYear: true, coverUrl: true },
        orderBy: { releaseYear: 'desc' },
      },
      songs: {
        select: {
          id: true,
          title: true,
          durationSec: true,
          genre: true,
          audioUrl: true,
          plays: true,
          albumId: true,
        },
        orderBy: { plays: 'desc' },
      },
    },
  });

  if (!artist) {
    throw new AppError('Artista no encontrado', 404);
  }
  return artist;
}

// Devuelve el perfil de artista del usuario autenticado.
// La usan también los servicios de álbumes y canciones
async function getArtistProfileByUserId(userId) {
  const artist = await prisma.artist.findUnique({ where: { userId } });
  if (!artist) {
    throw new AppError('Tu usuario no tiene un perfil de artista', 403);
  }
  return artist;
}

async function updateMyProfile(userId, data) {
  const artist = await getArtistProfileByUserId(userId);
  return prisma.artist.update({
    where: { id: artist.id },
    data,
    select: artistSelect,
  });
}

module.exports = { listArtists, getArtistById, getArtistProfileByUserId, updateMyProfile };

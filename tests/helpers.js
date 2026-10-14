// Funciones de apoyo compartidas por todas las pruebas
const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const DEFAULT_PASSWORD = 'Secreta123';

// Cliente HTTP contra la app (sin levantar el servidor en un puerto)
const api = () => request(app);

// Borra todos los datos, en orden para respetar las llaves foráneas
async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.playHistory.deleteMany();
  await prisma.playlistSong.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.song.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

// Crea un usuario directamente en la BD (más rápido que pasar por /register).
// Si es ARTISTA también crea su perfil.
async function createUser({ name, email, password = DEFAULT_PASSWORD, role = 'OYENTE', plan = 'FREE' }) {
  return prisma.user.create({
    data: {
      name,
      email,
      role,
      plan,
      password: await bcrypt.hash(password, 4), // pocas rondas: solo para pruebas
      ...(role === 'ARTISTA' && { artist: { create: { name, genre: 'cumbia' } } }),
    },
    include: { artist: true },
  });
}

// Inicia sesión por la API y devuelve { accessToken, refreshToken }
async function login(email, password = DEFAULT_PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login fallido para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

// Crea un álbum con canciones para un artista
async function createAlbum(artistId, { title = 'Álbum', releaseYear = 2024, songs = [] } = {}) {
  return prisma.album.create({
    data: {
      title,
      releaseYear,
      artistId,
      songs: {
        create: songs.map((song, i) => ({
          title: song.title,
          durationSec: song.durationSec || 200,
          genre: song.genre || 'cumbia',
          plays: song.plays || 0,
          audioUrl: `https://example.com/audio/${i}.mp3`,
          artistId,
        })),
      },
    },
    include: { songs: { orderBy: { id: 'asc' } } },
  });
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Lee el payload de un JWT sin verificar la firma (solo para inspeccionarlo)
function decodeToken(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

// Comprueba que una respuesta no exponga contraseñas ni hashes de bcrypt
function expectNoPassword(body, plainPassword = DEFAULT_PASSWORD) {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/"password"\s*:/);
  expect(text).not.toMatch(/\$2[aby]\$\d{2}\$/);
  expect(text).not.toContain(plainPassword);
}

// Carga una copia independiente de la app con otras variables de entorno
// (por ejemplo, un límite de login bajo). Devuelve también su cliente Prisma
// para poder desconectarlo al final.
function loadIsolatedApp(env) {
  const previous = {};
  for (const key of Object.keys(env)) previous[key] = process.env[key];
  Object.assign(process.env, env);

  let isolated;
  jest.isolateModules(() => {
    isolated = {
      app: require('../src/app'),
      prisma: require('../src/config/prisma'),
    };
  });

  // Se restauran las variables originales
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return isolated;
}

module.exports = {
  DEFAULT_PASSWORD,
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
  decodeToken,
  expectNoPassword,
  loadIsolatedApp,
};

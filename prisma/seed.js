// Datos de prueba para SonaGT API
// Ejecutar con: npm run seed
// Se puede ejecutar varias veces: primero limpia las tablas y luego inserta.
// Todos los artistas, álbumes y canciones son ficticios.
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const AUDIO_BASE = 'https://example.com/audio';
const COVER_BASE = 'https://example.com/covers';

// Convierte un título en un texto apto para URL: "Lluvia en Cobán" -> "lluvia-en-coban"
function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const listener = {
  name: 'Ana Pérez',
  email: 'oyente@sonagt.test',
  password: 'Oyente2026',
};

// Cada canción es [título, duración en segundos, reproducciones]
const artists = [
  {
    name: 'Marimba Flor de Xelajú',
    email: 'marimba@sonagt.test',
    password: 'Marimba2026',
    genre: 'marimba',
    bio: 'Marimba orquesta de Quetzaltenango que interpreta sones y valses tradicionales.',
    albums: [
      {
        title: 'Sones de mi Tierra',
        releaseYear: 2019,
        genre: 'marimba',
        songs: [
          ['Amanecer en Quetzaltenango', 214, 1520],
          ['Son del Lago de Atitlán', 187, 2310],
          ['Fiesta en Chichicastenango', 201, 980],
          ['Tarde en la Antigua', 233, 1745],
        ],
      },
      {
        title: 'Marimba de Concierto',
        releaseYear: 2022,
        genre: 'marimba',
        songs: [
          ['Vals de las Flores', 245, 640],
          ['Brisas del Pacífico', 198, 820],
          ['Noche de Feria', 176, 455],
        ],
      },
    ],
  },
  {
    name: 'Cumbia Volcánica',
    email: 'cumbia@sonagt.test',
    password: 'Cumbia2026',
    genre: 'cumbia',
    bio: 'Grupo de cumbia chapina nacido en Escuintla, a los pies del volcán de Pacaya.',
    albums: [
      {
        title: 'Fuego de Pacaya',
        releaseYear: 2021,
        genre: 'cumbia',
        songs: [
          ['Baila en el Volcán', 202, 5230],
          ['Cumbia Chapina', 195, 7410],
          ['La Camioneta Roja', 210, 3890],
          ['Tamalito de Chipilín', 188, 2950],
          ['Sábado en la Zona 1', 221, 4120],
        ],
      },
      {
        title: 'Tropical Chapín',
        releaseYear: 2023,
        genre: 'cumbia',
        songs: [
          ['Paseo en Tuc Tuc', 199, 3310],
          ['Cumbia del Mercado', 207, 2780],
          ['Agua de Coco', 184, 1960],
        ],
      },
    ],
  },
  {
    name: 'Diego Quetzal',
    email: 'cantautor@sonagt.test',
    password: 'Cantautor2026',
    genre: 'balada',
    bio: 'Cantautor capitalino que mezcla baladas acústicas con rock urbano.',
    albums: [
      {
        title: 'Cartas desde Petén',
        releaseYear: 2018,
        genre: 'balada',
        songs: [
          ['Cartas desde Petén', 256, 6120],
          ['Lluvia en Cobán', 238, 4870],
          ['Tu Nombre en el Lago', 247, 3540],
        ],
      },
      {
        title: 'Ruido en la Sexta',
        releaseYear: 2024,
        genre: 'rock',
        songs: [
          ['Ruido en la Sexta', 219, 2640],
          ['Carretera al Atlántico', 263, 1890],
          ['Ciudad de la Eterna Primavera', 241, 2210],
          ['Volcán de Fuego', 228, 3050],
        ],
      },
    ],
  },
];

// Borra los datos en orden (primero las tablas que dependen de otras)
async function cleanDatabase() {
  await prisma.playHistory.deleteMany();
  await prisma.playlistSong.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.song.deleteMany();
  await prisma.album.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser({ name, email, password }, role) {
  return prisma.user.create({
    data: { name, email, role, password: await bcrypt.hash(password, SALT_ROUNDS) },
  });
}

async function createArtistWithCatalog(data) {
  const user = await createUser(data, 'ARTISTA');
  const artist = await prisma.artist.create({
    data: { name: data.name, bio: data.bio, genre: data.genre, userId: user.id },
  });

  for (const album of data.albums) {
    await prisma.album.create({
      data: {
        title: album.title,
        releaseYear: album.releaseYear,
        coverUrl: `${COVER_BASE}/${slug(album.title)}.jpg`,
        artistId: artist.id,
        // Las canciones se crean junto con el álbum
        songs: {
          create: album.songs.map(([title, durationSec, plays]) => ({
            title,
            durationSec,
            plays,
            genre: album.genre,
            audioUrl: `${AUDIO_BASE}/${slug(title)}.mp3`,
            artistId: artist.id,
          })),
        },
      },
    });
  }
}

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Debes definir ADMIN_EMAIL y ADMIN_PASSWORD en el archivo .env');
  }

  console.log('Limpiando la base de datos...');
  await cleanDatabase();

  console.log('Creando usuarios...');
  await createUser({ name: 'Administrador', email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, 'ADMIN');
  await createUser(listener, 'OYENTE');
  for (const artist of artists) {
    await createArtistWithCatalog(artist);
  }

  const [users, artistCount, albums, songs] = await Promise.all([
    prisma.user.count(),
    prisma.artist.count(),
    prisma.album.count(),
    prisma.song.count(),
  ]);
  console.log(
    `Seed completado: ${users} usuarios, ${artistCount} artistas, ${albums} álbumes, ${songs} canciones`
  );
}

main()
  .catch((err) => {
    console.error('Error en el seed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

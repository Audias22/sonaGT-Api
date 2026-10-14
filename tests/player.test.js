// Pruebas del reproductor: play, skip e historial
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
} = require('./helpers');

let token;
let user;
let songs;

beforeAll(async () => {
  await resetDatabase();
  user = await createUser({ name: 'Oyente', email: 'oyente@test.gt' });
  const artist = (await createUser({ name: 'Artista', email: 'artista@test.gt', role: 'ARTISTA' })).artist;
  songs = (
    await createAlbum(artist.id, {
      songs: [
        { title: 'Primera', plays: 10 },
        { title: 'Segunda', plays: 20 },
      ],
    })
  ).songs;
  token = (await login('oyente@test.gt')).accessToken;
});

afterAll(() => prisma.$disconnect());

test('play incrementa plays y registra la reproducción (201)', async () => {
  const res = await api().post(`/api/v1/player/play/${songs[0].id}`).set(bearer(token));

  expect(res.status).toBe(201);
  expect(res.body.data.song).toEqual({ id: songs[0].id, title: 'Primera', plays: 11 });

  const stored = await prisma.song.findUnique({ where: { id: songs[0].id } });
  expect(stored.plays).toBe(11);
  expect(await prisma.playHistory.count({ where: { userId: user.id, skipped: false } })).toBe(1);
});

test('play de una canción inexistente responde 404 y no deja registros', async () => {
  const before = await prisma.playHistory.count();
  const res = await api().post('/api/v1/player/play/999999').set(bearer(token));

  expect(res.status).toBe(404);
  expect(await prisma.playHistory.count()).toBe(before);
});

test('id inválido responde 400', async () => {
  const res = await api().post('/api/v1/player/play/abc').set(bearer(token));
  expect(res.status).toBe(400);
  expect(res.body.errors[0].field).toBe('songId');
});

test('skip registra un salto (201) sin cambiar plays', async () => {
  const res = await api().post(`/api/v1/player/skip/${songs[1].id}`).set(bearer(token));

  expect(res.status).toBe(201);
  expect(res.body.data.songId).toBe(songs[1].id);
  const stored = await prisma.song.findUnique({ where: { id: songs[1].id } });
  expect(stored.plays).toBe(20);
});

test('skip de una canción inexistente responde 404', async () => {
  const res = await api().post('/api/v1/player/skip/999999').set(bearer(token));
  expect(res.status).toBe(404);
});

test('el historial va del más reciente al más antiguo, con canción y artista', async () => {
  const res = await api().get('/api/v1/player/history').set(bearer(token));

  expect(res.status).toBe(200);
  expect(res.body.meta.total).toBe(2);
  const [latest, oldest] = res.body.data;
  expect(latest).toMatchObject({ skipped: true, song: { title: 'Segunda', artist: { name: 'Artista' } } });
  expect(oldest).toMatchObject({ skipped: false, song: { title: 'Primera' } });
});

test('el historial es privado: otro usuario no ve el mío', async () => {
  await createUser({ name: 'Otro', email: 'otro@test.gt' });
  const other = (await login('otro@test.gt')).accessToken;

  const res = await api().get('/api/v1/player/history').set(bearer(other));
  expect(res.body.meta.total).toBe(0);
});

test('el reproductor requiere token (401)', async () => {
  const res = await api().post(`/api/v1/player/play/${songs[0].id}`);
  expect(res.status).toBe(401);
});

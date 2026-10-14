// Pruebas de playlists: CRUD, canciones y visibilidad (privada ajena → 404)
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
} = require('./helpers');

let ana; // dueña de las playlists
let beto; // otro usuario
let songs;
let privada;
let publica;

beforeAll(async () => {
  await resetDatabase();
  // PREMIUM para que el límite de playlists no interfiera (se prueba en plans.test.js)
  await createUser({ name: 'Ana', email: 'ana@test.gt', plan: 'PREMIUM' });
  await createUser({ name: 'Beto', email: 'beto@test.gt' });
  const artist = (await createUser({ name: 'Artista', email: 'artista@test.gt', role: 'ARTISTA' })).artist;
  songs = (await createAlbum(artist.id, { songs: [{ title: 'Uno' }, { title: 'Dos' }] })).songs;

  ana = (await login('ana@test.gt')).accessToken;
  beto = (await login('beto@test.gt')).accessToken;
});

afterAll(() => prisma.$disconnect());

test('crea playlists privadas por defecto y públicas si se indica (201)', async () => {
  const res1 = await api().post('/api/v1/playlists').set(bearer(ana)).send({ name: 'Privada' });
  const res2 = await api().post('/api/v1/playlists').set(bearer(ana)).send({ name: 'Pública', isPublic: true });

  expect(res1.status).toBe(201);
  expect(res1.body.data.isPublic).toBe(false);
  expect(res2.body.data.isPublic).toBe(true);
  privada = res1.body.data;
  publica = res2.body.data;
});

test('nombre vacío responde 400', async () => {
  const res = await api().post('/api/v1/playlists').set(bearer(ana)).send({ name: '' });
  expect(res.status).toBe(400);
});

test('agregar una canción (201), repetirla (409) y una inexistente (404)', async () => {
  const add = await api().post(`/api/v1/playlists/${privada.id}/songs`).set(bearer(ana)).send({ songId: songs[0].id });
  expect(add.status).toBe(201);
  expect(add.body.data).toMatchObject({ playlistId: privada.id, songId: songs[0].id });

  const repeated = await api().post(`/api/v1/playlists/${privada.id}/songs`).set(bearer(ana)).send({ songId: songs[0].id });
  expect(repeated.status).toBe(409);
  expect(repeated.body.message).toBe('La canción ya está en la playlist');

  const missing = await api().post(`/api/v1/playlists/${privada.id}/songs`).set(bearer(ana)).send({ songId: 999999 });
  expect(missing.status).toBe(404);
});

test('el detalle trae las canciones ordenadas por addedAt', async () => {
  await api().post(`/api/v1/playlists/${privada.id}/songs`).set(bearer(ana)).send({ songId: songs[1].id });

  const res = await api().get(`/api/v1/playlists/${privada.id}`).set(bearer(ana));
  expect(res.status).toBe(200);
  expect(res.body.data.owner.name).toBe('Ana');
  expect(res.body.data.songs.map((s) => s.title)).toEqual(['Uno', 'Dos']);
});

test('otro usuario recibe 404 en una playlist privada ajena y 200 en una pública', async () => {
  const hidden = await api().get(`/api/v1/playlists/${privada.id}`).set(bearer(beto));
  expect(hidden.status).toBe(404);
  expect(hidden.body.message).toBe('Playlist no encontrada');

  const visible = await api().get(`/api/v1/playlists/${publica.id}`).set(bearer(beto));
  expect(visible.status).toBe(200);
});

test('otro usuario no puede modificar: 403 en la pública y 404 en la privada', async () => {
  const publicPatch = await api().patch(`/api/v1/playlists/${publica.id}`).set(bearer(beto)).send({ name: 'Hack' });
  expect(publicPatch.status).toBe(403);

  const privatePatch = await api().patch(`/api/v1/playlists/${privada.id}`).set(bearer(beto)).send({ name: 'Hack' });
  expect(privatePatch.status).toBe(404);

  const addSong = await api().post(`/api/v1/playlists/${publica.id}/songs`).set(bearer(beto)).send({ songId: songs[0].id });
  expect(addSong.status).toBe(403);

  const del = await api().delete(`/api/v1/playlists/${privada.id}`).set(bearer(beto));
  expect(del.status).toBe(404);
});

test('GET /playlists/me lista solo las mías con paginación', async () => {
  await api().post('/api/v1/playlists').set(bearer(beto)).send({ name: 'De Beto' });

  const res = await api().get('/api/v1/playlists/me?limit=1').set(bearer(ana));
  expect(res.status).toBe(200);
  expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
  expect(res.body.data[0].userId).not.toBeUndefined();
});

test('el dueño edita la playlist (200)', async () => {
  const res = await api().patch(`/api/v1/playlists/${privada.id}`).set(bearer(ana)).send({ isPublic: true });
  expect(res.status).toBe(200);
  expect(res.body.data.isPublic).toBe(true);
});

test('quitar una canción (200) y quitarla otra vez (404)', async () => {
  const url = `/api/v1/playlists/${privada.id}/songs/${songs[0].id}`;
  const first = await api().delete(url).set(bearer(ana));
  const second = await api().delete(url).set(bearer(ana));

  expect(first.status).toBe(200);
  expect(second.status).toBe(404);
});

test('el dueño borra la playlist (200) y después no existe (404)', async () => {
  const del = await api().delete(`/api/v1/playlists/${publica.id}`).set(bearer(ana));
  expect(del.status).toBe(200);

  const res = await api().get(`/api/v1/playlists/${publica.id}`).set(bearer(ana));
  expect(res.status).toBe(404);
});

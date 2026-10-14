// Pruebas de las reglas de plan FREE vs PREMIUM y del cambio de plan
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
  decodeToken,
  expectNoPassword,
} = require('./helpers');

let songs;

beforeAll(async () => {
  await resetDatabase();
  const artist = (await createUser({ name: 'Artista', email: 'artista@test.gt', role: 'ARTISTA' })).artist;
  songs = (
    await createAlbum(artist.id, {
      songs: Array.from({ length: 8 }, (_, i) => ({ title: `Canción ${i + 1}` })),
    })
  ).songs;
});

afterAll(() => prisma.$disconnect());

const createPlaylist = (token, name) =>
  api().post('/api/v1/playlists').set(bearer(token)).send({ name });
const skip = (token, songId) => api().post(`/api/v1/player/skip/${songId}`).set(bearer(token));

describe('Plan FREE', () => {
  let token;

  beforeAll(async () => {
    await createUser({ name: 'Free', email: 'free@test.gt' });
    token = (await login('free@test.gt')).accessToken;
  });

  test('puede crear 3 playlists y la cuarta responde 403', async () => {
    for (let i = 1; i <= 3; i++) {
      expect((await createPlaylist(token, `Playlist ${i}`)).status).toBe(201);
    }

    const fourth = await createPlaylist(token, 'Playlist 4');
    expect(fourth.status).toBe(403);
    expect(fourth.body).toEqual({
      success: false,
      message: 'Límite de playlists del plan FREE alcanzado. Actualiza a PREMIUM',
      errors: [],
    });
    // La playlist rechazada no queda guardada (se revirtió la transacción)
    expect(await prisma.playlist.count({ where: { user: { email: 'free@test.gt' } } })).toBe(3);
  });

  test('puede saltar 6 canciones por hora; el séptimo salto responde 429 con los minutos que faltan', async () => {
    for (let i = 0; i < 6; i++) {
      expect((await skip(token, songs[i].id)).status).toBe(201);
    }

    const seventh = await skip(token, songs[6].id);
    expect(seventh.status).toBe(429);
    expect(seventh.body.message).toBe('Límite de saltos del plan FREE alcanzado. Actualiza a PREMIUM');
    expect(seventh.body.errors[0]).toMatchObject({ field: 'skip', retryAfterMinutes: 60 });
    expect(Number(seventh.headers['retry-after'])).toBeGreaterThan(3500);
    // El salto rechazado no queda guardado
    expect(await prisma.playHistory.count({ where: { user: { email: 'free@test.gt' }, skipped: true } })).toBe(6);
  });

  test('los saltos de hace más de una hora ya no cuentan', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'free@test.gt' } });
    await prisma.playHistory.updateMany({
      where: { userId: user.id, skipped: true },
      data: { playedAt: new Date(Date.now() - 61 * 60 * 1000) },
    });

    expect((await skip(token, songs[7].id)).status).toBe(201);
  });
});

describe('Límites atómicos ante peticiones simultáneas', () => {
  test('8 creaciones de playlist al mismo tiempo: solo 3 se guardan', async () => {
    await createUser({ name: 'Rápido', email: 'rapido@test.gt' });
    const { accessToken } = await login('rapido@test.gt');

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createPlaylist(accessToken, `Simultánea ${i}`))
    );
    const statuses = results.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.filter((s) => s === 403)).toHaveLength(5);
    expect(await prisma.playlist.count({ where: { user: { email: 'rapido@test.gt' } } })).toBe(3);
  });

  test('12 saltos al mismo tiempo: solo 6 se guardan', async () => {
    await createUser({ name: 'Saltarín', email: 'saltarin@test.gt' });
    const { accessToken } = await login('saltarin@test.gt');

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => skip(accessToken, songs[i % songs.length].id))
    );
    const statuses = results.map((r) => r.status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(6);
    expect(statuses.filter((s) => s === 429)).toHaveLength(6);
    expect(
      await prisma.playHistory.count({ where: { user: { email: 'saltarin@test.gt' }, skipped: true } })
    ).toBe(6);
  });
});

describe('Cambio a PREMIUM', () => {
  let oldTokens;
  let newTokens;

  beforeAll(async () => {
    await createUser({ name: 'Mejora', email: 'mejora@test.gt' });
    oldTokens = await login('mejora@test.gt');
    for (let i = 1; i <= 3; i++) await createPlaylist(oldTokens.accessToken, `P${i}`);
    for (let i = 0; i < 6; i++) await skip(oldTokens.accessToken, songs[i].id);
  });

  test('PATCH /users/me/plan devuelve un par nuevo de tokens con plan PREMIUM', async () => {
    const res = await api()
      .patch('/api/v1/users/me/plan')
      .set(bearer(oldTokens.accessToken))
      .send({ plan: 'PREMIUM' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.plan).toBe('PREMIUM');
    expect(decodeToken(res.body.data.accessToken).plan).toBe('PREMIUM');
    expectNoPassword(res.body);
    newTokens = res.body.data;
  });

  test('las sesiones anteriores quedan revocadas', async () => {
    const user = await prisma.user.findUnique({ where: { email: 'mejora@test.gt' } });
    const active = await prisma.refreshToken.count({ where: { userId: user.id, revoked: false } });
    expect(active).toBe(1); // solo la nueva
  });

  test('con el token nuevo ya puede crear la cuarta playlist y seguir saltando', async () => {
    expect((await createPlaylist(newTokens.accessToken, 'P4')).status).toBe(201);
    expect((await skip(newTokens.accessToken, songs[6].id)).status).toBe(201);
  });

  test('con el access token VIEJO el plan sigue siendo FREE hasta que expire', async () => {
    expect(decodeToken(oldTokens.accessToken).plan).toBe('FREE');
    expect((await skip(oldTokens.accessToken, songs[7].id)).status).toBe(429);
    expect((await createPlaylist(oldTokens.accessToken, 'P5')).status).toBe(403);
  });

  test('un plan inválido responde 400', async () => {
    const res = await api()
      .patch('/api/v1/users/me/plan')
      .set(bearer(newTokens.accessToken))
      .send({ plan: 'GRATIS' });
    expect(res.status).toBe(400);
  });
});

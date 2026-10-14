// Pruebas de administración: usuarios, roles y estadísticas
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
  expectNoPassword,
} = require('./helpers');

let admin;
let adminToken;
let oyente;
let oyenteToken;
let artistToken;

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser({ name: 'Admin', email: 'admin@test.gt', role: 'ADMIN' });
  oyente = await createUser({ name: 'Oyente', email: 'oyente@test.gt' });
  await createUser({ name: 'Premium', email: 'premium@test.gt', plan: 'PREMIUM' });
  const artist = await createUser({ name: 'Artista', email: 'artista@test.gt', role: 'ARTISTA' });
  await createAlbum(artist.artist.id, {
    songs: [
      { title: 'Hit', plays: 500 },
      { title: 'Normal', plays: 20 },
    ],
  });

  adminToken = (await login('admin@test.gt')).accessToken;
  oyenteToken = (await login('oyente@test.gt')).accessToken;
  artistToken = (await login('artista@test.gt')).accessToken;
});

afterAll(() => prisma.$disconnect());

describe('Acceso solo para ADMIN', () => {
  test.each([
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/stats'],
    ['get', '/api/v1/admin/audit-logs'],
    ['patch', '/api/v1/admin/users/1/role'],
  ])('%s %s responde 403 a OYENTE y ARTISTA, y 401 sin token', async (method, url) => {
    for (const token of [oyenteToken, artistToken]) {
      const res = await api()[method](url).set(bearer(token)).send({ role: 'ADMIN' });
      expect(res.status).toBe(403);
    }
    expect((await api()[method](url)).status).toBe(401);
  });
});

describe('GET /admin/users', () => {
  test('lista usuarios paginados sin contraseñas', async () => {
    const res = await api().get('/api/v1/admin/users').set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(4);
    expectNoPassword(res.body);
  });

  test('filtra por rol y valida el filtro', async () => {
    const res = await api().get('/api/v1/admin/users?role=ARTISTA').set(bearer(adminToken));
    expect(res.body.data.map((u) => u.email)).toEqual(['artista@test.gt']);

    const invalid = await api().get('/api/v1/admin/users?role=JEFE').set(bearer(adminToken));
    expect(invalid.status).toBe(400);
  });
});

describe('GET /admin/stats', () => {
  test('devuelve totales por rol y plan, canciones, reproducciones y top 5', async () => {
    const res = await api().get('/api/v1/admin/stats').set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      users: {
        total: 4,
        byRole: { OYENTE: 2, ARTISTA: 1, ADMIN: 1 },
        byPlan: { FREE: 3, PREMIUM: 1 },
      },
      totalSongs: 2,
      totalPlays: 520,
      topSongs: [
        expect.objectContaining({ title: 'Hit', plays: 500 }),
        expect.objectContaining({ title: 'Normal', plays: 20 }),
      ],
    });
  });
});

describe('PATCH /admin/users/:id/role', () => {
  test('cambia el rol, crea el perfil de artista si hace falta y revoca sus sesiones', async () => {
    const { refreshToken } = await login('oyente@test.gt');

    const res = await api()
      .patch(`/api/v1/admin/users/${oyente.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'ARTISTA' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ARTISTA');
    expectNoPassword(res.body);
    expect(await prisma.artist.findUnique({ where: { userId: oyente.id } })).toMatchObject({ name: 'Oyente' });

    const refresh = await api().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);
  });

  test('un ADMIN no puede quitarse a sí mismo el rol ADMIN (400)', async () => {
    const res = await api()
      .patch(`/api/v1/admin/users/${admin.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'OYENTE' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No puedes quitarte a ti mismo el rol ADMIN');
    expect((await prisma.user.findUnique({ where: { id: admin.id } })).role).toBe('ADMIN');
  });

  test('usuario inexistente responde 404 y rol inválido 400', async () => {
    const missing = await api()
      .patch('/api/v1/admin/users/999999/role')
      .set(bearer(adminToken))
      .send({ role: 'OYENTE' });
    expect(missing.status).toBe(404);

    const invalid = await api()
      .patch(`/api/v1/admin/users/${oyente.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'SUPERADMIN' });
    expect(invalid.status).toBe(400);
  });
});

// Pruebas de la bitácora de auditoría
const request = require('supertest');
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
  loadIsolatedApp,
} = require('./helpers');

let admin;
let adminToken;
let oyente;
let artist;

// Último registro de una acción
const lastLog = (action) =>
  prisma.auditLog.findFirst({ where: { action }, orderBy: { id: 'desc' } });

beforeAll(async () => {
  await resetDatabase();
  admin = await createUser({ name: 'Admin', email: 'admin@test.gt', role: 'ADMIN' });
  oyente = await createUser({ name: 'Oyente', email: 'oyente@test.gt' });
  artist = await createUser({ name: 'Artista', email: 'artista@test.gt', role: 'ARTISTA' });
  adminToken = (await login('admin@test.gt')).accessToken;
});

afterAll(() => prisma.$disconnect());

describe('Eventos registrados', () => {
  test('LOGIN_SUCCESS guarda usuario, IP y user-agent', async () => {
    await api().post('/api/v1/auth/login').set('User-Agent', 'jest-agent').send({
      email: 'oyente@test.gt',
      password: 'Secreta123',
    });

    const log = await lastLog('LOGIN_SUCCESS');
    expect(log).toMatchObject({ userId: oyente.id, userAgent: 'jest-agent' });
    expect(log.ip).toEqual(expect.any(String));
  });

  test('LOGIN_FAILED guarda el email intentado pero nunca la contraseña', async () => {
    await api().post('/api/v1/auth/login').send({ email: 'oyente@test.gt', password: 'ClaveSecreta99' });
    const known = await lastLog('LOGIN_FAILED');
    expect(known.userId).toBe(oyente.id);
    expect(JSON.parse(known.details)).toEqual({ email: 'oyente@test.gt' });
    expect(known.details).not.toContain('ClaveSecreta99');

    await api().post('/api/v1/auth/login').send({ email: 'nadie@test.gt', password: 'ClaveSecreta99' });
    const unknown = await lastLog('LOGIN_FAILED');
    expect(unknown.userId).toBeNull();
    expect(JSON.parse(unknown.details)).toEqual({ email: 'nadie@test.gt' });
  });

  test('TOKEN_REUSE_DETECTED indica cuántas sesiones se cerraron', async () => {
    const sessionA = await login('oyente@test.gt');
    await login('oyente@test.gt');
    await api().post('/api/v1/auth/refresh').send({ refreshToken: sessionA.refreshToken });
    await api().post('/api/v1/auth/refresh').send({ refreshToken: sessionA.refreshToken });

    const log = await lastLog('TOKEN_REUSE_DETECTED');
    expect(log.userId).toBe(oyente.id);
    expect(JSON.parse(log.details).revokedSessions).toBeGreaterThanOrEqual(2);
  });

  test('LOGOUT', async () => {
    const { refreshToken } = await login('oyente@test.gt');
    await api().post('/api/v1/auth/logout').send({ refreshToken });

    expect((await lastLog('LOGOUT')).userId).toBe(oyente.id);
  });

  test('PLAN_CHANGED guarda el plan anterior y el nuevo', async () => {
    const { accessToken } = await login('oyente@test.gt');
    await api().patch('/api/v1/users/me/plan').set(bearer(accessToken)).send({ plan: 'PREMIUM' });

    const log = await lastLog('PLAN_CHANGED');
    expect(log.userId).toBe(oyente.id);
    expect(JSON.parse(log.details)).toEqual({ from: 'FREE', to: 'PREMIUM' });
  });

  test('ROLE_CHANGED guarda quién lo cambió, a quién, el rol anterior y el nuevo', async () => {
    await api()
      .patch(`/api/v1/admin/users/${oyente.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'ARTISTA' });

    const log = await lastLog('ROLE_CHANGED');
    expect(log.userId).toBe(admin.id);
    expect(JSON.parse(log.details)).toEqual({
      targetUserId: oyente.id,
      targetEmail: 'oyente@test.gt',
      from: 'OYENTE',
      to: 'ARTISTA',
    });
  });

  test('RESOURCE_DELETED solo cuando un ADMIN borra contenido de otro artista', async () => {
    const album = await createAlbum(artist.artist.id, {
      title: 'Para borrar',
      songs: [{ title: 'Canción A' }, { title: 'Canción B' }],
    });
    const artistToken = (await login('artista@test.gt')).accessToken;

    // El artista borra su propia canción: no se audita
    await api().delete(`/api/v1/songs/${album.songs[0].id}`).set(bearer(artistToken));
    expect(await prisma.auditLog.count({ where: { action: 'RESOURCE_DELETED' } })).toBe(0);

    // El admin borra una canción y un álbum del artista: sí se auditan
    await api().delete(`/api/v1/songs/${album.songs[1].id}`).set(bearer(adminToken));
    await api().delete(`/api/v1/albums/${album.id}`).set(bearer(adminToken));

    const logs = await prisma.auditLog.findMany({ where: { action: 'RESOURCE_DELETED' }, orderBy: { id: 'asc' } });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.userId === admin.id)).toBe(true);
    expect(JSON.parse(logs[0].details)).toMatchObject({ resource: 'song', title: 'Canción B' });
    expect(JSON.parse(logs[1].details)).toMatchObject({ resource: 'album', title: 'Para borrar' });
  });

  test('RATE_LIMIT_EXCEEDED en el login', async () => {
    const limited = loadIsolatedApp({ LOGIN_RATE_LIMIT_MAX: '1' });
    const body = { email: 'atacante@test.gt', password: 'Prueba123' };

    await request(limited.app).post('/api/v1/auth/login').send(body);
    const blocked = await request(limited.app).post('/api/v1/auth/login').send(body);
    await limited.prisma.$disconnect();

    expect(blocked.status).toBe(429);
    const log = await lastLog('RATE_LIMIT_EXCEEDED');
    expect(JSON.parse(log.details)).toEqual({ route: '/api/v1/auth/login', email: 'atacante@test.gt' });
    expect(log.details).not.toContain('Prueba123');
  });
});

describe('Robustez', () => {
  test('si falla el guardado del log, la petición responde normal y el error va a consola', async () => {
    const createSpy = jest
      .spyOn(prisma.auditLog, 'create')
      .mockRejectedValueOnce(new Error('BD no disponible'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await api().post('/api/v1/auth/login').send({ email: 'admin@test.gt', password: 'Secreta123' });

    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[auditoría]'));
    createSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe('GET /admin/audit-logs', () => {
  test('lista paginada, del más reciente al más antiguo, con details como objeto', async () => {
    const res = await api().get('/api/v1/admin/audit-logs?limit=3').set(bearer(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.limit).toBe(3);
    const ids = res.body.data.map((l) => l.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  test('filtra por acción y por usuario', async () => {
    const byAction = await api().get('/api/v1/admin/audit-logs?action=PLAN_CHANGED').set(bearer(adminToken));
    expect(byAction.body.data).toHaveLength(1);
    expect(byAction.body.data[0].details).toEqual({ from: 'FREE', to: 'PREMIUM' });
    expect(byAction.body.data[0].user).toMatchObject({ email: 'oyente@test.gt' });

    const byUser = await api().get(`/api/v1/admin/audit-logs?userId=${admin.id}`).set(bearer(adminToken));
    expect(byUser.body.data.length).toBeGreaterThan(0);
    expect(byUser.body.data.every((l) => l.userId === admin.id)).toBe(true);
  });

  test('filtros inválidos responden 400', async () => {
    for (const query of ['action=HACKEO', 'userId=abc']) {
      const res = await api().get(`/api/v1/admin/audit-logs?${query}`).set(bearer(adminToken));
      expect(res.status).toBe(400);
    }
  });
});

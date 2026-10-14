// Pruebas de autenticación: registro, login, /me, refresh tokens y rate limit
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  bearer,
  decodeToken,
  expectNoPassword,
  loadIsolatedApp,
} = require('./helpers');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

beforeAll(async () => {
  await resetDatabase();
  await createUser({ name: 'Ana Oyente', email: 'ana@test.gt' });
});

afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  test('registra un OYENTE (201) sin devolver la contraseña y la guarda con bcrypt', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Luis Oyente', email: 'Luis@Test.gt', password: 'Secreta123' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: 'luis@test.gt', // se normaliza a minúsculas
      role: 'OYENTE',
      plan: 'FREE',
      artist: null,
    });
    expectNoPassword(res.body);

    const stored = await prisma.user.findUnique({ where: { email: 'luis@test.gt' } });
    expect(stored.password).toMatch(/^\$2b\$10\$/);
  });

  test('registra un ARTISTA (201) y crea su perfil con el mismo nombre', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Marimba Test', email: 'marimba@test.gt', password: 'Secreta123', role: 'ARTISTA' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('ARTISTA');
    expect(res.body.data.artist).toMatchObject({ name: 'Marimba Test' });
    expectNoPassword(res.body);
  });

  test('email repetido (aunque cambien las mayúsculas) responde 409', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Otra Ana', email: 'ANA@test.gt', password: 'Secreta123' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: 'El email ya está registrado', errors: [] });
  });

  test('contraseña débil responde 400 indicando el campo', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Débil', email: 'debil@test.gt', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field)).toContain('password');
  });

  test('nadie puede registrarse como ADMIN (400)', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Hacker', email: 'hacker@test.gt', password: 'Secreta123', role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('role');
  });

  test('JSON mal formado responde 400 con el formato de error', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'El cuerpo de la petición no es un JSON válido',
      errors: [],
    });
  });
});

describe('POST /auth/login', () => {
  test('credenciales correctas devuelven accessToken y refreshToken', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@test.gt', password: 'Secreta123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expectNoPassword(res.body);

    const payload = decodeToken(res.body.data.accessToken);
    expect(payload).toMatchObject({ role: 'OYENTE', plan: 'FREE' });
    expect(payload.sub).toEqual(expect.any(String));
  });

  test('contraseña incorrecta y email inexistente dan el mismo 401 genérico', async () => {
    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ana@test.gt', password: 'Equivocada1' });
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@test.gt', password: 'Equivocada1' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, message: 'Credenciales inválidas', errors: [] });
    }
  });

  test('body incompleto responde 400', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email: 'ana@test.gt' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });
});

describe('GET /auth/me', () => {
  test('con token devuelve el usuario sin contraseña (200)', async () => {
    const { accessToken } = await login('ana@test.gt');
    const res = await api().get('/api/v1/auth/me').set(bearer(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('ana@test.gt');
    expectNoPassword(res.body);
  });

  test('sin token responde 401', async () => {
    const res = await api().get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token no proporcionado');
  });

  test('token alterado responde 401', async () => {
    const { accessToken } = await login('ana@test.gt');
    const res = await api().get('/api/v1/auth/me').set(bearer(`${accessToken.slice(0, -3)}abc`));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token inválido');
  });

  test('token vencido responde 401 "Token expirado"', async () => {
    const expired = jwt.sign(
      { sub: '1', role: 'OYENTE', plan: 'FREE', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );
    const res = await api().get('/api/v1/auth/me').set(bearer(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token expirado');
  });

  test('token sin firma (alg "none") responde 401', async () => {
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: '1', role: 'ADMIN' })}.`;
    const res = await api().get('/api/v1/auth/me').set(bearer(unsigned));
    expect(res.status).toBe(401);
  });

  test('un refresh token no sirve como access token (401)', async () => {
    const { refreshToken } = await login('ana@test.gt');
    const res = await api().get('/api/v1/auth/me').set(bearer(refreshToken));
    expect(res.status).toBe(401);
  });
});

describe('Refresh tokens', () => {
  test('en la BD se guarda el hash SHA-256, no el token', async () => {
    const { refreshToken } = await login('ana@test.gt');

    const byRaw = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    const byHash = await prisma.refreshToken.findUnique({ where: { token: sha256(refreshToken) } });

    expect(byRaw).toBeNull();
    expect(byHash).not.toBeNull();
    expect(byHash.token).toMatch(/^[a-f0-9]{64}$/);
  });

  test('rotación: entrega un par nuevo y revoca el token usado', async () => {
    const { refreshToken } = await login('ana@test.gt');
    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(refreshToken);

    const old = await prisma.refreshToken.findUnique({ where: { token: sha256(refreshToken) } });
    expect(old.revoked).toBe(true);
  });

  test('reutilizar un refresh revocado responde 401 y cierra TODAS las sesiones', async () => {
    const user = await createUser({ name: 'Víctima', email: 'victima@test.gt' });
    const sessionA = await login('victima@test.gt');
    const sessionB = await login('victima@test.gt');

    // Uso normal: rota la sesión A
    const rotated = await api().post('/api/v1/auth/refresh').send({ refreshToken: sessionA.refreshToken });
    expect(rotated.status).toBe(200);

    // Alguien reutiliza el token viejo de A
    const reuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: sessionA.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toMatch(/reutilización/);

    // Ya no sirve ni la sesión B ni el token recién rotado
    for (const refreshToken of [sessionB.refreshToken, rotated.body.data.refreshToken]) {
      const res = await api().post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);
    }
    const active = await prisma.refreshToken.count({ where: { userId: user.id, revoked: false } });
    expect(active).toBe(0);
  });

  test('un refresh token inválido o un access token responden 401', async () => {
    const { accessToken } = await login('ana@test.gt');
    for (const refreshToken of ['no-es-un-jwt', accessToken]) {
      const res = await api().post('/api/v1/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Refresh token inválido o expirado');
    }
  });

  test('logout revoca el refresh token y después ya no se puede renovar', async () => {
    const { refreshToken } = await login('ana@test.gt');

    const logout = await api().post('/api/v1/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.message).toBe('Sesión cerrada correctamente');

    const res = await api().post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('Rate limit del login', () => {
  // Copia de la app con un límite de 3 intentos (la suite usa un límite alto)
  const limited = loadIsolatedApp({ LOGIN_RATE_LIMIT_MAX: '3' });
  const request = require('supertest');

  afterAll(() => limited.prisma.$disconnect());

  test('al superar el límite responde 429 con el formato de error, aunque la contraseña sea correcta', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(limited.app)
        .post('/api/v1/auth/login')
        .send({ email: 'ana@test.gt', password: 'Equivocada1' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(limited.app)
      .post('/api/v1/auth/login')
      .send({ email: 'ana@test.gt', password: 'Secreta123' });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: 'Demasiados intentos de inicio de sesión, intenta de nuevo en 15 minutos',
      errors: [],
    });
  });
});

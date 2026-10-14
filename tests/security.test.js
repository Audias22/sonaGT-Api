// Pruebas de configuración de seguridad: CORS, cabeceras, documentación y errores
const request = require('supertest');
const { api, prisma, loadIsolatedApp } = require('./helpers');

afterAll(() => prisma.$disconnect());

describe('CORS', () => {
  test('un origen permitido recibe Access-Control-Allow-Origin', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('un origen no permitido no recibe la cabecera (el navegador bloquea la respuesta)', async () => {
    const res = await api().get('/api/v1/health').set('Origin', 'http://sitio-malicioso.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await api()
      .options('/api/v1/auth/login')
      .set('Origin', 'http://sitio-malicioso.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Cabeceras de seguridad (helmet)', () => {
  test('la API envía CSP completa y otras cabeceras de seguridad', async () => {
    const res = await api().get('/api/v1/health');

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Documentación Swagger', () => {
  test('fuera de producción está disponible y su CSP no incluye upgrade-insecure-requests', async () => {
    const res = await api().get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  test('en producción no existe (404)', async () => {
    const production = loadIsolatedApp({ NODE_ENV: 'production' });
    const res = await request(production.app).get('/api/docs/');
    await production.prisma.$disconnect();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('Errores', () => {
  test('una ruta inexistente responde 404 con el formato estándar', async () => {
    const res = await api().get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Ruta no encontrada: GET /api/v1/no-existe',
      errors: [],
    });
  });

  test('un error interno responde 500 genérico sin detalles', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest
      .spyOn(prisma.song, 'findUnique')
      .mockRejectedValueOnce(new Error('detalle interno de la base de datos'));

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: '1', role: 'OYENTE', plan: 'FREE' }, process.env.JWT_SECRET);
    const res = await api().get('/api/v1/songs/1').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Error interno del servidor', errors: [] });
    expect(JSON.stringify(res.body)).not.toContain('detalle interno');
    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});

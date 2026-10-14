// Variables de entorno para las pruebas.
// Se definen antes de cargar la app; dotenv no las sobrescribe con las de .env,
// así las pruebas nunca tocan prisma/dev.db.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db'; // relativo a prisma/schema.prisma
process.env.JWT_SECRET = 'secreto-de-pruebas-access';
process.env.JWT_REFRESH_SECRET = 'secreto-de-pruebas-refresh';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGINS = 'http://localhost:3000';
// Límite alto para que el rate limit del login no bloquee la suite.
// La prueba del 429 carga una copia de la app con un límite bajo.
process.env.LOGIN_RATE_LIMIT_MAX = '1000';

// Carga y centraliza las variables de entorno
// (dotenv no sobrescribe variables que ya existan, por eso las pruebas pueden
// definir su propia DATABASE_URL antes de cargar este archivo)
require('dotenv').config({ quiet: true });

const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
}

// "http://a.com, http://b.com" -> ['http://a.com', 'http://b.com']
function parseList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  // Orígenes (frontends) que pueden llamar a la API desde un navegador
  corsOrigins: parseList(process.env.CORS_ORIGINS || 'http://localhost:3000'),
  // Intentos de login permitidos por IP en la ventana de tiempo
  loginRateLimit: {
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    windowMinutes: 15,
  },
};

// Lógica de negocio de autenticación
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { logEvent } = require('./audit.service');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/jwt');

const SALT_ROUNDS = 10;

// Campos del usuario que se pueden devolver (nunca la contraseña)
const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  plan: true,
  createdAt: true,
  artist: true,
};

// Hash ficticio para comparar cuando el email no existe: así el tiempo de
// respuesta es similar y no se puede deducir qué emails están registrados
const DUMMY_HASH = bcrypt.hashSync('dummy-password', SALT_ROUNDS);

async function register({ name, email, password, role = 'OYENTE' }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('El email ya está registrado', 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const data = { name, email, password: hashedPassword, role };
  // Si es artista se crea su perfil en la misma operación
  if (role === 'ARTISTA') {
    data.artist = { create: { name } };
  }

  return prisma.user.create({ data, select: publicUserSelect });
}

// Genera el par de tokens y guarda el refresh token en la base de datos
async function createTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const { exp } = verifyRefreshToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      token: hashToken(refreshToken), // se guarda solo el hash
      userId: user.id,
      expiresAt: new Date(exp * 1000),
    },
  });

  return { accessToken, refreshToken };
}

// context: { ip, userAgent } de la petición, para la auditoría
async function login({ email, password }, context) {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

  // Mensaje genérico: no se revela si falló el email o la contraseña
  if (!user || !passwordOk) {
    // Se guarda el email intentado, nunca la contraseña
    await logEvent('LOGIN_FAILED', { userId: user ? user.id : null, context, details: { email } });
    throw new AppError('Credenciales inválidas', 401);
  }

  await logEvent('LOGIN_SUCCESS', { userId: user.id, context });
  return createTokenPair(user);
}

// Revoca todas las sesiones activas de un usuario y devuelve cuántas eran
async function revokeAllSessions(userId) {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
  return count;
}

// Se llama cuando alguien usa un refresh token ya revocado. Eso indica que el
// token pudo ser robado, así que se cierran todas las sesiones del usuario
async function handleTokenReuse(userId, context) {
  const revokedSessions = await revokeAllSessions(userId);
  await logEvent('TOKEN_REUSE_DETECTED', { userId, context, details: { revokedSessions } });
  throw new AppError(
    'Se detectó la reutilización de un refresh token; todas las sesiones fueron cerradas',
    401
  );
}

async function refresh(refreshToken, context) {
  try {
    verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Refresh token inválido o expirado', 401);
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: hashToken(refreshToken) },
    include: { user: true },
  });

  if (!stored) {
    throw new AppError('Refresh token inválido o expirado', 401);
  }
  if (stored.revoked) {
    await handleTokenReuse(stored.userId, context);
  }
  if (stored.expiresAt < new Date()) {
    throw new AppError('Refresh token inválido o expirado', 401);
  }

  // Rotación: se revoca el token usado. La condición revoked:false evita que
  // dos peticiones simultáneas con el mismo token obtengan tokens nuevos;
  // si otra petición ya lo revocó, también se trata como reutilización
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revoked: false },
    data: { revoked: true },
  });
  if (count === 0) {
    await handleTokenReuse(stored.userId, context);
  }

  // Se usan los datos actuales del usuario (por si cambió su rol o plan)
  return createTokenPair(stored.user);
}

async function logout(refreshToken, context) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });

  // Si el token no existe no se hace nada (la respuesta es la misma)
  if (!stored) return;

  await prisma.refreshToken.updateMany({
    where: { token: tokenHash },
    data: { revoked: true },
  });
  await logEvent('LOGOUT', { userId: stored.userId, context });
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }
  return user;
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  getProfile,
  // También las usan los servicios de usuarios y administración
  createTokenPair,
  revokeAllSessions,
};

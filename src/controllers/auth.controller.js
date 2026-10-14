// Controladores de autenticación: reciben la petición y llaman al servicio
// (Express 5 envía automáticamente los errores de funciones async al errorHandler)
const authService = require('../services/auth.service');
const { getRequestContext } = require('../utils/requestContext');

async function register(req, res) {
  const user = await authService.register(req.body);
  res.status(201).json({ success: true, data: user });
}

async function login(req, res) {
  const tokens = await authService.login(req.body, getRequestContext(req));
  res.json({ success: true, data: tokens });
}

async function refresh(req, res) {
  const tokens = await authService.refresh(req.body.refreshToken, getRequestContext(req));
  res.json({ success: true, data: tokens });
}

async function logout(req, res) {
  await authService.logout(req.body.refreshToken, getRequestContext(req));
  res.json({ success: true, message: 'Sesión cerrada correctamente' });
}

async function me(req, res) {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, data: user });
}

module.exports = { register, login, refresh, logout, me };

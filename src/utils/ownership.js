// Verifica que el usuario autenticado sea dueño de un recurso
const AppError = require('./AppError');

// ownerUserId: id del usuario dueño del perfil de artista del recurso
// allowAdmin: si es true, un ADMIN también puede (por ejemplo, para borrar)
function checkOwnership(ownerUserId, user, { allowAdmin = false } = {}) {
  if (allowAdmin && user.role === 'ADMIN') {
    return;
  }
  if (ownerUserId !== user.id) {
    throw new AppError('No tienes permiso para modificar este recurso', 403);
  }
}

module.exports = { checkOwnership };

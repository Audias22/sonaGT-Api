// Reglas de negocio según el plan del usuario (FREE / PREMIUM)
// El plan se toma de req.user.plan, que viene DEL TOKEN.
//
// Para que los límites sean atómicos, los servicios usan estas funciones
// dentro de una transacción con el patrón "insertar y luego contar":
//   1. se inserta el registro nuevo (playlist o salto)
//   2. se cuenta cuántos hay, incluyendo el nuevo
//   3. si se pasó del límite se lanza un error y la transacción se revierte
// SQLite permite una sola transacción de escritura a la vez, así que si llegan
// dos peticiones simultáneas la segunda espera a que la primera termine y su
// conteo ya incluye el registro de la primera. Nunca se supera el límite.
const AppError = require('./AppError');

const ONE_HOUR_MS = 60 * 60 * 1000;

// Límites de cada plan (Infinity = sin límite)
const PLAN_LIMITS = {
  FREE: { maxPlaylists: 3, maxSkipsPerHour: 6 },
  PREMIUM: { maxPlaylists: Infinity, maxSkipsPerHour: Infinity },
};

function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
}

// total: playlists del usuario contando la recién creada
function checkPlaylistLimit(plan, total) {
  if (total > getPlanLimits(plan).maxPlaylists) {
    throw new AppError('Límite de playlists del plan FREE alcanzado. Actualiza a PREMIUM', 403);
  }
}

// skipDates: fechas de los saltos de la última hora (de la más antigua a la
// más reciente), contando el recién creado
function checkSkipLimit(plan, skipDates) {
  if (skipDates.length <= getPlanLimits(plan).maxSkipsPerHour) {
    return;
  }

  // Se libera un salto cuando el más antiguo de la última hora cumple 1 hora
  const waitMs = skipDates[0].getTime() + ONE_HOUR_MS - Date.now();
  const minutes = Math.max(1, Math.ceil(waitMs / 60000));

  const error = new AppError('Límite de saltos del plan FREE alcanzado. Actualiza a PREMIUM', 429, [
    {
      field: 'skip',
      message: `Podrás saltar de nuevo en ${minutes} minuto(s)`,
      retryAfterMinutes: minutes,
    },
  ]);
  // El errorHandler lo envía en la cabecera Retry-After
  error.retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  throw error;
}

module.exports = { ONE_HOUR_MS, PLAN_LIMITS, getPlanLimits, checkPlaylistLimit, checkSkipLimit };

// Extrae de la petición los datos que se guardan en la auditoría.
// Los servicios reciben este objeto en lugar de req, así no dependen de Express
function getRequestContext(req) {
  return {
    ip: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

module.exports = { getRequestContext };

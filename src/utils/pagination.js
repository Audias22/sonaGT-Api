// Ayudas para paginar consultas de Prisma

// Convierte page/limit en los parámetros skip/take de Prisma
function paginate({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

// Construye el objeto meta que acompaña a las listas
function buildMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { paginate, buildMeta };

// Controladores de álbumes
const { getRequestContext } = require('../utils/requestContext');
const albumService = require('../services/album.service');

async function getById(req, res) {
  const album = await albumService.getAlbumById(req.params.id);
  res.json({ success: true, data: album });
}

async function create(req, res) {
  const album = await albumService.createAlbum(req.user.id, req.body);
  res.status(201).json({ success: true, data: album });
}

async function update(req, res) {
  const album = await albumService.updateAlbum(req.params.id, req.user, req.body);
  res.json({ success: true, data: album });
}

async function remove(req, res) {
  await albumService.deleteAlbum(req.params.id, req.user, getRequestContext(req));
  res.json({ success: true, message: 'Álbum eliminado correctamente' });
}

module.exports = { getById, create, update, remove };

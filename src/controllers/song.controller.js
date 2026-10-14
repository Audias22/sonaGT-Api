// Controladores de canciones
const { getRequestContext } = require('../utils/requestContext');
const songService = require('../services/song.service');

async function list(req, res) {
  const { data, meta } = await songService.listSongs(req.query);
  res.json({ success: true, data, meta });
}

async function getById(req, res) {
  const song = await songService.getSongById(req.params.id);
  res.json({ success: true, data: song });
}

async function create(req, res) {
  const song = await songService.createSong(req.user.id, req.body);
  res.status(201).json({ success: true, data: song });
}

async function update(req, res) {
  const song = await songService.updateSong(req.params.id, req.user, req.body);
  res.json({ success: true, data: song });
}

async function remove(req, res) {
  await songService.deleteSong(req.params.id, req.user, getRequestContext(req));
  res.json({ success: true, message: 'Canción eliminada correctamente' });
}

module.exports = { list, getById, create, update, remove };

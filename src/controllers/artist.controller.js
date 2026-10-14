// Controladores de artistas
const artistService = require('../services/artist.service');

async function list(req, res) {
  const { data, meta } = await artistService.listArtists(req.query);
  res.json({ success: true, data, meta });
}

async function getById(req, res) {
  const artist = await artistService.getArtistById(req.params.id);
  res.json({ success: true, data: artist });
}

async function updateMe(req, res) {
  const artist = await artistService.updateMyProfile(req.user.id, req.body);
  res.json({ success: true, data: artist });
}

module.exports = { list, getById, updateMe };

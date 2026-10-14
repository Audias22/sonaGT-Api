// Controladores de playlists
const playlistService = require('../services/playlist.service');

async function listMine(req, res) {
  const { data, meta } = await playlistService.listMyPlaylists(req.user.id, req.query);
  res.json({ success: true, data, meta });
}

async function getById(req, res) {
  const playlist = await playlistService.getPlaylistById(req.params.id, req.user.id);
  res.json({ success: true, data: playlist });
}

async function create(req, res) {
  const playlist = await playlistService.createPlaylist(req.user, req.body);
  res.status(201).json({ success: true, data: playlist });
}

async function update(req, res) {
  const playlist = await playlistService.updatePlaylist(req.params.id, req.user.id, req.body);
  res.json({ success: true, data: playlist });
}

async function remove(req, res) {
  await playlistService.deletePlaylist(req.params.id, req.user.id);
  res.json({ success: true, message: 'Playlist eliminada correctamente' });
}

async function addSong(req, res) {
  const entry = await playlistService.addSong(req.params.id, req.user.id, req.body.songId);
  res.status(201).json({ success: true, data: entry });
}

async function removeSong(req, res) {
  await playlistService.removeSong(req.params.id, req.user.id, req.params.songId);
  res.json({ success: true, message: 'Canción quitada de la playlist' });
}

module.exports = { listMine, getById, create, update, remove, addSong, removeSong };

// Controladores del reproductor
const playerService = require('../services/player.service');

async function play(req, res) {
  const result = await playerService.play(req.user.id, req.params.songId);
  res.status(201).json({ success: true, data: result });
}

async function skip(req, res) {
  const result = await playerService.skip(req.user, req.params.songId);
  res.status(201).json({ success: true, data: result });
}

async function history(req, res) {
  const { data, meta } = await playerService.getHistory(req.user.id, req.query);
  res.json({ success: true, data, meta });
}

module.exports = { play, skip, history };

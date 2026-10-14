// Router principal de la API (prefijo /api/v1)
const { Router } = require('express');
const authRoutes = require('./auth.routes');
const artistRoutes = require('./artist.routes');
const albumRoutes = require('./album.routes');
const songRoutes = require('./song.routes');
const playlistRoutes = require('./playlist.routes');
const playerRoutes = require('./player.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/artists', artistRoutes);
router.use('/albums', albumRoutes);
router.use('/songs', songRoutes);
router.use('/playlists', playlistRoutes);
router.use('/player', playerRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

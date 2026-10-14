// Pruebas del catálogo: artistas, álbumes y canciones (roles y propiedad)
const {
  api,
  prisma,
  resetDatabase,
  createUser,
  login,
  createAlbum,
  bearer,
} = require('./helpers');

let tokens; // access tokens por usuario
let marimba; // perfil de artista de A
let cumbia; // perfil de artista de B
let cumbiaAlbum;

beforeAll(async () => {
  await resetDatabase();
  await createUser({ name: 'Oyente', email: 'oyente@test.gt' });
  await createUser({ name: 'Admin', email: 'admin@test.gt', role: 'ADMIN' });
  marimba = (await createUser({ name: 'Marimba Test', email: 'marimba@test.gt', role: 'ARTISTA' })).artist;
  cumbia = (await createUser({ name: 'Cumbia Test', email: 'cumbia@test.gt', role: 'ARTISTA' })).artist;

  await createAlbum(marimba.id, {
    title: 'Sones del Lago',
    songs: [
      { title: 'Son del Lago', genre: 'marimba', plays: 100 },
      { title: 'Amanecer en Xela', genre: 'marimba', plays: 900 },
    ],
  });
  cumbiaAlbum = await createAlbum(cumbia.id, {
    title: 'Fuego',
    songs: [
      { title: 'Cumbia Chapina', genre: 'cumbia', plays: 5000 },
      { title: 'Baila en el Lago', genre: 'cumbia', plays: 300 },
      { title: 'Agua de Coco', genre: 'cumbia', plays: 50 },
    ],
  });

  tokens = {
    oyente: (await login('oyente@test.gt')).accessToken,
    admin: (await login('admin@test.gt')).accessToken,
    marimba: (await login('marimba@test.gt')).accessToken,
    cumbia: (await login('cumbia@test.gt')).accessToken,
  };
});

afterAll(() => prisma.$disconnect());

describe('Acceso al catálogo', () => {
  test.each(['/api/v1/songs', '/api/v1/artists', '/api/v1/albums/1'])(
    '%s sin token responde 401',
    async (url) => {
      const res = await api().get(url);
      expect(res.status).toBe(401);
    }
  );
});

describe('GET /songs', () => {
  test('paginación con meta', async () => {
    const res = await api().get('/api/v1/songs?page=2&limit=2').set(bearer(tokens.oyente));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  test('búsqueda por título (?q=)', async () => {
    const res = await api().get('/api/v1/songs?q=lago').set(bearer(tokens.oyente));
    expect(res.body.data.map((s) => s.title).sort()).toEqual(['Baila en el Lago', 'Son del Lago']);
  });

  test('filtro por género y por artista', async () => {
    const byGenre = await api().get('/api/v1/songs?genre=MARIMBA').set(bearer(tokens.oyente));
    expect(byGenre.body.meta.total).toBe(2);
    expect(byGenre.body.data.every((s) => s.genre === 'marimba')).toBe(true);

    const byArtist = await api().get(`/api/v1/songs?artistId=${cumbia.id}`).set(bearer(tokens.oyente));
    expect(byArtist.body.meta.total).toBe(3);
  });

  test('sort=popular ordena por reproducciones', async () => {
    const res = await api().get('/api/v1/songs?sort=popular&limit=3').set(bearer(tokens.oyente));
    expect(res.body.data.map((s) => s.plays)).toEqual([5000, 900, 300]);
  });

  test('parámetros de query inválidos responden 400', async () => {
    for (const query of ['limit=100', 'page=0', 'sort=nuevo', 'artistId=abc']) {
      const res = await api().get(`/api/v1/songs?${query}`).set(bearer(tokens.oyente));
      expect(res.status).toBe(400);
    }
  });

  test('id inválido responde 400 e id inexistente 404', async () => {
    const invalid = await api().get('/api/v1/songs/abc').set(bearer(tokens.oyente));
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors[0]).toEqual({
      field: 'id',
      message: 'El id debe ser un número entero positivo',
    });

    const missing = await api().get('/api/v1/songs/999999').set(bearer(tokens.oyente));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Canción no encontrada');
  });
});

describe('Artistas', () => {
  test('lista con búsqueda y detalle con álbumes y canciones', async () => {
    const list = await api().get('/api/v1/artists?q=cumbia').set(bearer(tokens.oyente));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).not.toHaveProperty('userId');

    const detail = await api().get(`/api/v1/artists/${cumbia.id}`).set(bearer(tokens.oyente));
    expect(detail.status).toBe(200);
    expect(detail.body.data.albums).toHaveLength(1);
    expect(detail.body.data.songs).toHaveLength(3);
  });

  test('PATCH /artists/me: el ARTISTA edita su perfil y el OYENTE recibe 403', async () => {
    const ok = await api()
      .patch('/api/v1/artists/me')
      .set(bearer(tokens.marimba))
      .send({ bio: 'Marimba de Quetzaltenango', genre: 'Marimba' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ bio: 'Marimba de Quetzaltenango', genre: 'marimba' });

    const forbidden = await api().patch('/api/v1/artists/me').set(bearer(tokens.oyente)).send({ bio: 'x' });
    expect(forbidden.status).toBe(403);

    const empty = await api().patch('/api/v1/artists/me').set(bearer(tokens.marimba)).send({});
    expect(empty.status).toBe(400);
  });
});

describe('Creación y propiedad de álbumes y canciones', () => {
  let newAlbum;
  let newSong;

  test('un OYENTE no puede crear canciones ni álbumes (403)', async () => {
    const song = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.oyente))
      .send({ title: 'X', durationSec: 100, audioUrl: 'https://example.com/x.mp3' });
    const album = await api().post('/api/v1/albums').set(bearer(tokens.oyente)).send({ title: 'X', releaseYear: 2024 });

    expect(song.status).toBe(403);
    expect(album.status).toBe(403);
  });

  test('el ARTISTA crea un álbum propio (201) y se ignora el artistId del body', async () => {
    const res = await api()
      .post('/api/v1/albums')
      .set(bearer(tokens.marimba))
      .send({ title: 'Nuevo Álbum', releaseYear: 2025, artistId: cumbia.id });

    expect(res.status).toBe(201);
    expect(res.body.data.artistId).toBe(marimba.id);
    newAlbum = res.body.data;
  });

  test('el ARTISTA crea una canción en su álbum (201); plays empieza en 0 aunque se envíe', async () => {
    const res = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.marimba))
      .send({
        title: 'Canción Nueva',
        durationSec: 180,
        audioUrl: 'https://example.com/nueva.mp3',
        albumId: newAlbum.id,
        plays: 999999,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ plays: 0, artist: { id: marimba.id }, album: { id: newAlbum.id } });
    newSong = res.body.data;
  });

  test('crear una canción en un álbum ajeno responde 403 y en uno inexistente 404', async () => {
    const body = { title: 'Intrusa', durationSec: 100, audioUrl: 'https://example.com/x.mp3' };

    const foreign = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.marimba))
      .send({ ...body, albumId: cumbiaAlbum.id });
    expect(foreign.status).toBe(403);

    const missing = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.marimba))
      .send({ ...body, albumId: 999999 });
    expect(missing.status).toBe(404);
  });

  test('solo se aceptan URLs http(s)', async () => {
    const res = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.marimba))
      .send({ title: 'XSS', durationSec: 100, audioUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('audioUrl');
  });

  test('otro ARTISTA no puede editar ni borrar la canción (403); el dueño sí la edita', async () => {
    const patch = await api().patch(`/api/v1/songs/${newSong.id}`).set(bearer(tokens.cumbia)).send({ title: 'Hack' });
    const del = await api().delete(`/api/v1/songs/${newSong.id}`).set(bearer(tokens.cumbia));
    expect(patch.status).toBe(403);
    expect(del.status).toBe(403);

    const own = await api()
      .patch(`/api/v1/songs/${newSong.id}`)
      .set(bearer(tokens.marimba))
      .send({ title: 'Canción Editada' });
    expect(own.status).toBe(200);
    expect(own.body.data.title).toBe('Canción Editada');
  });

  test('editar o borrar algo inexistente responde 404', async () => {
    const patch = await api().patch('/api/v1/albums/999999').set(bearer(tokens.marimba)).send({ title: 'X' });
    const del = await api().delete('/api/v1/songs/999999').set(bearer(tokens.admin));
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });

  test('otro ARTISTA no puede editar el álbum (403); el dueño sí', async () => {
    const foreign = await api().patch(`/api/v1/albums/${newAlbum.id}`).set(bearer(tokens.cumbia)).send({ title: 'X' });
    expect(foreign.status).toBe(403);

    const own = await api()
      .patch(`/api/v1/albums/${newAlbum.id}`)
      .set(bearer(tokens.marimba))
      .send({ releaseYear: 2026 });
    expect(own.status).toBe(200);
    expect(own.body.data.releaseYear).toBe(2026);
  });

  test('el ADMIN puede borrar la canción de cualquier artista (200)', async () => {
    const res = await api().delete(`/api/v1/songs/${newSong.id}`).set(bearer(tokens.admin));
    expect(res.status).toBe(200);
    expect(await prisma.song.findUnique({ where: { id: newSong.id } })).toBeNull();
  });

  test('al borrar un álbum sus canciones quedan como sencillos', async () => {
    const song = await api()
      .post('/api/v1/songs')
      .set(bearer(tokens.marimba))
      .send({ title: 'Sencillo', durationSec: 150, audioUrl: 'https://example.com/s.mp3', albumId: newAlbum.id });

    const res = await api().delete(`/api/v1/albums/${newAlbum.id}`).set(bearer(tokens.marimba));
    expect(res.status).toBe(200);

    const detail = await api().get(`/api/v1/songs/${song.body.data.id}`).set(bearer(tokens.oyente));
    expect(detail.status).toBe(200);
    expect(detail.body.data.album).toBeNull();
  });

  test('GET /albums/:id devuelve el álbum con su artista y canciones', async () => {
    const res = await api().get(`/api/v1/albums/${cumbiaAlbum.id}`).set(bearer(tokens.oyente));
    expect(res.status).toBe(200);
    expect(res.body.data.artist).toEqual({ id: cumbia.id, name: 'Cumbia Test' });
    expect(res.body.data.songs).toHaveLength(3);
  });
});

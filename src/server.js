// Punto de entrada: levanta el servidor HTTP
const config = require('./config/env');
const app = require('./app');

app.listen(config.port, () => {
  console.log(`SonaGT API escuchando en http://localhost:${config.port}`);
});

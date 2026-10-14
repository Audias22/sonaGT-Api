// Configuración de la aplicación Express
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const config = require('./config/env');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares globales
app.use(helmet());
// Solo los orígenes de CORS_ORIGINS reciben la cabecera Access-Control-Allow-Origin;
// para cualquier otro origen el navegador bloquea la lectura de la respuesta
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Rutas
app.use('/api/v1', routes);

// Documentación: solo fuera de producción, para no exponer públicamente el
// mapa completo de la API. En producción ni siquiera se carga el módulo.
if (config.nodeEnv !== 'production') {
  app.use('/api/docs', require('./routes/docs.routes'));
}

// Manejo de rutas inexistentes y errores (siempre al final)
app.use(notFound);
app.use(errorHandler);

module.exports = app;

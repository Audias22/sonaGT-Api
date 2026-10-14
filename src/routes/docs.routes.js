// Documentación Swagger UI (/api/docs)
// Solo se monta fuera de producción (ver app.js)
const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const helmet = require('helmet');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const specPath = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));

const router = Router();

// CSP propia SOLO para esta ruta. Se parte de la CSP por defecto de helmet y
// se quita "upgrade-insecure-requests": como el servidor local usa http,
// esa directiva hace que el navegador pida los archivos de Swagger UI por
// https y la página queda en blanco. El resto de la API conserva la CSP completa.
router.use(
  helmet.contentSecurityPolicy({
    directives: { upgradeInsecureRequests: null },
  })
);

router.use(swaggerUi.serve);
router.use(swaggerUi.setup(spec, { customSiteTitle: 'SonaGT API - Documentación' }));

module.exports = router;

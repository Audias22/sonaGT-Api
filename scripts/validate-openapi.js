// Valida docs/openapi.yaml y comprueba que documente todas las rutas de Express
// Ejecutar con: npm run docs:validate
const fs = require('fs');
const path = require('path');
const SwaggerParser = require('@apidevtools/swagger-parser');

const ROOT = path.join(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Lee las rutas declaradas en src/routes/*.routes.js usando los prefijos de index.js
function getExpressRoutes() {
  const index = fs.readFileSync(path.join(ROUTES_DIR, 'index.js'), 'utf8');
  const routes = [];

  // Rutas definidas directamente en index.js (por ejemplo /health)
  for (const [, method, route] of index.matchAll(/router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g)) {
    routes.push(`${method.toUpperCase()} ${route}`);
  }

  // router.use('/songs', songRoutes) -> require('./song.routes')
  for (const [, prefix, variable] of index.matchAll(/router\.use\(\s*'([^']+)',\s*(\w+)\s*\)/g)) {
    const file = index.match(new RegExp(`const ${variable} = require\\('\\./([\\w.]+)'\\)`))[1];
    const source = fs.readFileSync(path.join(ROUTES_DIR, `${file}.js`), 'utf8');
    for (const [, method, route] of source.matchAll(/router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g)) {
      const full = (prefix + (route === '/' ? '' : route)).replace(/:(\w+)/g, '{$1}');
      routes.push(`${method.toUpperCase()} ${full}`);
    }
  }
  return routes;
}

async function main() {
  // 1. Validación estructural contra el estándar OpenAPI
  const api = await SwaggerParser.validate(path.join(ROOT, 'docs', 'openapi.yaml'));
  console.log(`✔ Especificación válida: ${api.info.title} ${api.info.version} (OpenAPI ${api.openapi})`);

  // 2. Cobertura: rutas de Express vs. rutas documentadas
  const documented = [];
  for (const [route, item] of Object.entries(api.paths)) {
    for (const method of METHODS) {
      if (item[method]) documented.push(`${method.toUpperCase()} ${route}`);
    }
  }
  const express = getExpressRoutes();
  const missing = express.filter((r) => !documented.includes(r));
  const extra = documented.filter((r) => !express.includes(r));

  console.log(`✔ Rutas en Express: ${express.length} | Rutas documentadas: ${documented.length}`);
  if (missing.length) console.log('✘ Sin documentar:', missing);
  if (extra.length) console.log('✘ Documentadas pero inexistentes:', extra);

  // 3. Cada operación debe tener tag y ejemplos en todas sus respuestas
  const problems = [];
  for (const [route, item] of Object.entries(api.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      if (!op.tags?.length) problems.push(`${method.toUpperCase()} ${route}: sin tag`);
      for (const [code, res] of Object.entries(op.responses)) {
        const media = res.content?.['application/json'];
        if (!media?.example && !media?.examples) {
          problems.push(`${method.toUpperCase()} ${route} ${code}: sin ejemplo`);
        }
      }
    }
  }
  if (problems.length) console.log('✘ Problemas:', problems);
  else console.log('✔ Todas las operaciones tienen tag y ejemplo en cada respuesta');

  if (missing.length || extra.length || problems.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('✘ Especificación inválida:', err.message);
  process.exitCode = 1;
});

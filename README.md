# SonaGT API

API REST de una plataforma de streaming de música guatemalteca, análoga a Spotify. Permite
registrarse, explorar un catálogo de artistas, álbumes y canciones, crear playlists, reproducir y
saltar canciones, y administrar usuarios.

Es un proyecto universitario del curso de **Seguridad y Auditoría**, por lo que además de la
funcionalidad se cuidan aspectos como el manejo de contraseñas y tokens, el control de acceso por
roles y la validación de todas las entradas. No reproduce audio real: las canciones apuntan a URLs
de ejemplo.

## Tecnologías

| Uso | Herramienta |
|---|---|
| Servidor | Node.js + Express 5 (JavaScript) |
| Base de datos | SQLite con Prisma ORM 6 |
| Autenticación | jsonwebtoken (JWT) y bcrypt |
| Validación | zod |
| Seguridad HTTP | helmet, cors, express-rate-limit |
| Documentación | OpenAPI 3 + swagger-ui-express |
| Pruebas | Jest + supertest |
| Desarrollo | nodemon, @apidevtools/swagger-parser |

## Requisitos

- Node.js 20 o superior (probado con Node 24)
- npm

## Instalación (Windows)

Desde PowerShell, en la carpeta del proyecto:

```powershell
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de configuración a partir del ejemplo
Copy-Item .env.example .env
```

Abre `.env` y completa los valores vacíos:

- `JWT_SECRET` y `JWT_REFRESH_SECRET`: dos cadenas largas y distintas. Puedes generarlas con
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `ADMIN_PASSWORD`: la contraseña del usuario administrador que creará el seed (mínimo 8
  caracteres, con una mayúscula y un número).

Las demás variables ya traen un valor por defecto. `CORS_ORIGINS` es la lista de orígenes, separados
por coma, que pueden llamar a la API desde un navegador (por defecto `http://localhost:3000`).
`LOGIN_RATE_LIMIT_MAX` es el número de intentos de login por IP cada 15 minutos (por defecto 5).

```powershell
# 3. Crear la base de datos y aplicar las migraciones
npx prisma migrate dev

# 4. Cargar los datos de prueba
npm run seed

# 5. Levantar el servidor en modo desarrollo (se reinicia al guardar cambios)
npm run dev
```

La API queda en `http://localhost:3000/api/v1` y la documentación interactiva en
`http://localhost:3000/api/docs`.

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor con nodemon |
| `npm start` | Servidor con node |
| `npm run seed` | Borra los datos y carga los de prueba (se puede ejecutar varias veces) |
| `npm test` | Ejecuta las pruebas automáticas (usa `prisma/test.db`, no toca `dev.db`) |
| `npm run test:coverage` | Pruebas con reporte de cobertura (se genera en `coverage/`) |
| `npm run docs:validate` | Valida `docs/openapi.yaml` y verifica que documente todas las rutas |

## Usuarios de prueba

Creados por `npm run seed`. Todos los artistas, álbumes y canciones son ficticios.

| Rol | Email | Contraseña | Descripción |
|---|---|---|---|
| ADMIN | `admin@sonagt.test` | Valor de `ADMIN_PASSWORD` en `.env` | Administrador |
| OYENTE | `oyente@sonagt.test` | `Oyente2026` | Ana Pérez, plan FREE |
| ARTISTA | `marimba@sonagt.test` | `Marimba2026` | Marimba Flor de Xelajú (marimba) |
| ARTISTA | `cumbia@sonagt.test` | `Cumbia2026` | Cumbia Volcánica (cumbia) |
| ARTISTA | `cantautor@sonagt.test` | `Cantautor2026` | Diego Quetzal (balada y rock) |

Cada artista tiene 2 álbumes con 3 a 5 canciones (22 canciones en total).

## Estructura del proyecto

```
sonaGT-Api/
├── docs/
│   ├── openapi.yaml                  Especificación OpenAPI de la API
│   └── propuesta-buenas-practicas.md Documento de la propuesta de buenas prácticas
├── prisma/
│   ├── schema.prisma     Modelos de la base de datos
│   ├── migrations/       Historial de migraciones
│   └── seed.js           Datos de prueba
├── scripts/              Scripts auxiliares (validación de la documentación)
├── tests/                Pruebas automáticas (Jest + supertest)
└── src/
    ├── server.js         Punto de entrada: levanta el servidor
    ├── app.js            Configura Express, middlewares globales y rutas
    ├── config/           Variables de entorno y cliente de Prisma
    ├── routes/           Define las URLs y qué middlewares y controlador atienden cada una
    ├── controllers/      Leen la petición, llaman al servicio y arman la respuesta HTTP
    ├── services/         Lógica de negocio, acceso a la base de datos y auditoría
    ├── middlewares/      Autenticación, roles, validación, rate limit y errores
    ├── validators/       Esquemas zod para body, params y query
    └── utils/            Funciones de apoyo (JWT, paginación, propiedad, límites de plan, AppError)
```

Una petición recorre las capas en este orden:
`route → middlewares (auth, rol, validación) → controller → service → Prisma`.

## Endpoints

Todas las rutas parten de `/api/v1`. "Autenticado" significa cualquier rol con un access token
válido. El detalle de cada endpoint (parámetros, body, respuestas y ejemplos) está en
`/api/docs`.

| Método | Ruta | Rol requerido | Descripción |
|---|---|---|---|
| GET | `/health` | Público | Estado del servidor |
| **Auth** | | | |
| POST | `/auth/register` | Público | Registrarse como OYENTE o ARTISTA |
| POST | `/auth/login` | Público | Iniciar sesión (máx. 5 intentos / 15 min por IP) |
| POST | `/auth/refresh` | Público (refresh token) | Renovar tokens con rotación |
| POST | `/auth/logout` | Público (refresh token) | Revocar el refresh token |
| GET | `/auth/me` | Autenticado | Mis datos |
| **Artistas** | | | |
| GET | `/artists` | Autenticado | Listar (paginado, `?q=`, `?genre=`) |
| GET | `/artists/:id` | Autenticado | Detalle con álbumes y canciones |
| PATCH | `/artists/me` | ARTISTA | Editar bio y género de mi perfil |
| **Álbumes** | | | |
| GET | `/albums/:id` | Autenticado | Detalle con canciones |
| POST | `/albums` | ARTISTA | Crear álbum en mi perfil |
| PATCH | `/albums/:id` | ARTISTA dueño | Editar álbum |
| DELETE | `/albums/:id` | ARTISTA dueño o ADMIN | Eliminar álbum |
| **Canciones** | | | |
| GET | `/songs` | Autenticado | Listar (paginado, `?q=`, `?genre=`, `?artistId=`, `?sort=popular`) |
| GET | `/songs/:id` | Autenticado | Detalle con artista y álbum |
| POST | `/songs` | ARTISTA | Crear canción (el álbum debe ser propio) |
| PATCH | `/songs/:id` | ARTISTA dueño | Editar canción |
| DELETE | `/songs/:id` | ARTISTA dueño o ADMIN | Eliminar canción |
| **Playlists** | | | |
| GET | `/playlists/me` | Autenticado | Mis playlists (paginado) |
| GET | `/playlists/:id` | Autenticado | Detalle (privada ajena → 404) |
| POST | `/playlists` | Autenticado | Crear (FREE: máximo 3) |
| PATCH | `/playlists/:id` | Dueño | Editar |
| DELETE | `/playlists/:id` | Dueño | Eliminar |
| POST | `/playlists/:id/songs` | Dueño | Agregar canción |
| DELETE | `/playlists/:id/songs/:songId` | Dueño | Quitar canción |
| **Reproductor** | | | |
| POST | `/player/play/:songId` | Autenticado | Reproducir (historial + plays en una transacción) |
| POST | `/player/skip/:songId` | Autenticado | Saltar (FREE: máximo 6 por hora) |
| GET | `/player/history` | Autenticado | Mi historial (paginado, más reciente primero) |
| **Usuarios** | | | |
| PATCH | `/users/me/plan` | Autenticado | Cambiar de plan (simulado) y recibir tokens nuevos |
| **Admin** | | | |
| GET | `/admin/users` | ADMIN | Listar usuarios (paginado, `?role=`) |
| PATCH | `/admin/users/:id/role` | ADMIN | Cambiar el rol de un usuario |
| GET | `/admin/stats` | ADMIN | Estadísticas generales |
| GET | `/admin/audit-logs` | ADMIN | Bitácora de auditoría (paginado, `?action=`, `?userId=`) |

Paginación: `?page=` (por defecto 1) y `?limit=` (por defecto 10, máximo 50).

## Autenticación

**Access token.** Al iniciar sesión se entrega un JWT firmado con `JWT_SECRET` que dura 15
minutos y contiene `{ sub: userId, role, plan }`. Se envía en cada petición protegida con el
header `Authorization: Bearer <token>`. El middleware `auth.js` lo verifica y guarda su contenido
en `req.user`. Un token vencido responde `401 "Token expirado"`.

**Refresh token con rotación.** Junto con el access token se entrega un refresh token firmado
con otro secreto (`JWT_REFRESH_SECRET`) que dura 7 días. Sirve para pedir un par nuevo en
`POST /auth/refresh`. Cada vez que se usa, el refresh token se revoca y se emite uno nuevo, por lo
que cada refresh token sirve una sola vez.

**Hash SHA-256 en la base de datos.** La tabla `RefreshToken` no guarda el token, sino su hash
SHA-256. Si alguien obtuviera una copia de la base de datos, no podría usar esos valores para
renovar sesiones.

**Detección de reutilización.** Si llega un refresh token que ya estaba revocado, significa que
alguien está usando un token viejo, posiblemente robado. En ese caso se revocan **todas** las
sesiones activas del usuario y se responde 401, así que tanto el atacante como el usuario legítimo
deben volver a iniciar sesión.

**Otras medidas.**
- Las contraseñas se guardan con bcrypt (10 rondas).
- El login responde siempre "Credenciales inválidas", sin indicar si falló el email o la
  contraseña, y tarda aproximadamente lo mismo en ambos casos.
- El login permite como máximo 5 intentos cada 15 minutos por IP.
- CORS solo acepta los orígenes de `CORS_ORIGINS`.
- Nadie puede registrarse como ADMIN; solo otro ADMIN puede asignar ese rol, y un ADMIN no puede
  quitárselo a sí mismo.
- Un ARTISTA solo puede modificar sus propios álbumes y canciones. El `artistId` siempre se toma
  del usuario autenticado, nunca del body.

## Planes FREE y PREMIUM

| Regla | FREE | PREMIUM |
|---|---|---|
| Playlists | Máximo 3 (la cuarta responde 403) | Sin límite |
| Saltos de canción | Máximo 6 por hora (el séptimo responde 429 e indica los minutos que faltan) | Sin límite |

El plan se lee de `req.user.plan`, es decir, **del access token**. Los límites están definidos en
`src/utils/planLimits.js`.

Los límites son atómicos. El servicio inserta la playlist o el salto y luego cuenta, todo dentro de
una misma transacción; si el total supera el límite, la transacción se revierte. SQLite permite una
sola transacción de escritura a la vez, así que si llegan varias peticiones simultáneas, cada una
cuenta los registros de las anteriores y nunca se supera el límite. Las pruebas lo verifican
enviando 8 creaciones de playlist y 12 saltos al mismo tiempo.

El cambio de plan es simulado (`PATCH /users/me/plan`). Como el plan va dentro del JWT, esa ruta
revoca los refresh tokens del usuario y devuelve un par nuevo de tokens con el plan actualizado.

## Auditoría

Los eventos de seguridad se guardan en la tabla `AuditLog` mediante `src/services/audit.service.js`.
Cada registro tiene el usuario que realizó la acción (si se conoce), la acción, la IP, el
user-agent, un campo `details` con datos adicionales en JSON y la fecha.

| Acción | Cuándo | details |
|---|---|---|
| `LOGIN_SUCCESS` | Login correcto | |
| `LOGIN_FAILED` | Login incorrecto | Email intentado (nunca la contraseña) |
| `TOKEN_REUSE_DETECTED` | Se reutilizó un refresh token revocado | Sesiones cerradas |
| `LOGOUT` | Cierre de sesión | |
| `PLAN_CHANGED` | Cambio de plan | Plan anterior y nuevo |
| `ROLE_CHANGED` | Un admin cambia un rol | Usuario afectado, rol anterior y nuevo |
| `RESOURCE_DELETED` | Un admin borra una canción o álbum de otro artista | Tipo, id, título y artista |
| `RATE_LIMIT_EXCEEDED` | Se bloquea un intento de login por rate limit | Ruta y email intentado |

Si falla el guardado de un registro, la petición continúa normalmente y el error se escribe en
consola. Los registros se consultan en `GET /admin/audit-logs` (solo ADMIN).

## Pruebas

```powershell
npm test               # ejecuta la suite
npm run test:coverage  # con reporte de cobertura
```

Las pruebas usan Jest y supertest contra la app de Express, sin levantar el servidor. Antes de
empezar se recrea `prisma/test.db` con las mismas migraciones, así que nunca se modifica `dev.db`.
Están organizadas por archivo en `tests/`: `auth`, `catalog`, `playlists`, `player`, `plans`,
`admin`, `audit` y `security`. Durante las pruebas el límite de login se sube con
`LOGIN_RATE_LIMIT_MAX` para no bloquear la suite; una prueba carga la app con un límite bajo para
verificar el 429.

## Formato de respuestas

Respuesta exitosa:

```json
{ "success": true, "data": { } }
```

Listas paginadas:

```json
{
  "success": true,
  "data": [ ],
  "meta": { "page": 1, "limit": 10, "total": 22, "totalPages": 3 }
}
```

Errores (todos pasan por el middleware global `errorHandler.js`):

```json
{
  "success": false,
  "message": "Error de validación",
  "errors": [
    { "field": "password", "message": "La contraseña debe tener al menos una mayúscula" }
  ]
}
```

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos en body, params o query |
| 401 | Falta el token, es inválido o expiró; credenciales incorrectas |
| 403 | El rol no tiene permiso, el recurso es de otro usuario o se alcanzó el límite de playlists |
| 404 | El recurso no existe (o es una playlist privada ajena) |
| 409 | Email ya registrado o canción repetida en una playlist |
| 429 | Demasiados intentos de login o límite de saltos alcanzado |
| 500 | Error interno (se registra en consola y no se exponen detalles) |

## Documentación (Swagger)

La especificación está escrita a mano en `docs/openapi.yaml` y se sirve en `/api/docs`.

- Solo está disponible cuando `NODE_ENV` es distinto de `production`. En producción la ruta ni
  siquiera se monta, para no exponer públicamente el mapa completo de la API.
- helmet aplica una Content-Security-Policy a toda la API. Para `/api/docs` se usa la misma
  política, excepto la directiva `upgrade-insecure-requests`. Esa directiva obliga al navegador a
  pedir los archivos de Swagger UI por https y, como el servidor local usa http, la página queda en
  blanco al abrirla desde otra computadora de la red. El resto de la API conserva la política
  completa.
- `npm run docs:validate` valida la especificación y comprueba que todas las rutas de Express estén
  documentadas.

## Limitaciones conocidas

- **El access token conserva el rol y el plan hasta que expira.** Un JWT no se puede modificar ni
  invalidar antes de tiempo. Si un usuario baja a FREE o un administrador le cambia el rol, su
  access token anterior sigue siendo válido con los datos viejos hasta por 15 minutos. Revocar los
  refresh tokens solo impide que lo renueve. Por eso el access token tiene una duración corta.
- **Usar un refresh token viejo cierra todas las sesiones.** Esto incluye el token anterior a un
  cambio de plan o a un logout, porque se trata como una reutilización. El cliente debe reemplazar
  siempre ambos tokens.
- **El rate limit del login se guarda en memoria.** Se reinicia al reiniciar el servidor y no se
  comparte entre varias instancias.
- **La búsqueda con `?q=` distingue tildes.** "coban" no encuentra "Cobán". Ignora mayúsculas solo
  en letras sin tilde; es una limitación de SQLite.
- **La atomicidad de los límites depende de SQLite.** Funciona porque SQLite permite una sola
  escritura a la vez. Con PostgreSQL u otra base de datos habría que bloquear explícitamente (por
  ejemplo, con `SELECT ... FOR UPDATE` sobre el usuario).
- **Las reproducciones no tienen límite.** Un cliente automatizado podría inflar el contador
  `plays` de una canción.
- **La bitácora de auditoría no se depura sola.** Crece sin límite y no hay una política de
  retención.
- **El plan y la reproducción son simulados.** No hay pagos reales ni audio real.
- **No hay HTTPS.** El servidor usa http; en producción debe ir detrás de un proxy con TLS.

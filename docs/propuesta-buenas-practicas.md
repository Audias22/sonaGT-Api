# Propuesta de buenas prácticas para el desarrollo seguro de APIs REST

Caso de estudio: SonaGT API

Curso: Seguridad y Auditoría

## 1. Introducción

SonaGT API es una API REST para una plataforma de streaming de música guatemalteca, parecida a
Spotify. Permite registrarse, explorar un catálogo de artistas, álbumes y canciones, crear
playlists, reproducir y saltar canciones, cambiar de plan (FREE o PREMIUM) y administrar usuarios.
Está hecha con Node.js, Express, Prisma y SQLite.

El objetivo de esta propuesta es reunir un conjunto de buenas prácticas para construir APIs más
seguras y fáciles de mantener, y mostrar cómo se aplicó cada una en un proyecto real. Para cada
práctica se explica qué es, qué riesgo ayuda a evitar y en qué parte del código de SonaGT se puede
ver. Al final se relacionan las medidas con el OWASP API Security Top 10 de 2023 y se describen las
limitaciones que todavía tiene el proyecto.

## 2. Buenas prácticas aplicadas

### 2.1 Arquitectura por capas

Qué es. Consiste en separar el código según su responsabilidad: una capa recibe la petición, otra
aplica las reglas de negocio y otra accede a los datos.

Por qué importa. Cuando todo está mezclado en un mismo archivo es fácil olvidar una validación o un
control de permisos en alguna ruta. Separar las capas hace que cada control tenga un lugar fijo, que
el código sea más fácil de revisar y que un cambio en una parte no rompa las demás.

Cómo se aplicó. Cada petición sigue el recorrido ruta, middlewares, controlador, servicio y Prisma.
Las rutas (`src/routes/`) solo indican qué middlewares y qué controlador atienden cada URL. Los
controladores (`src/controllers/`) leen la petición y arman la respuesta. Los servicios
(`src/services/`) tienen la lógica de negocio y las consultas a la base de datos. La validación está
en `src/validators/` y los controles transversales (autenticación, roles, validación, errores) en
`src/middlewares/`.

### 2.2 Diseño REST y versionado

Qué es. Usar URLs que representan recursos (sustantivos en plural), los métodos HTTP según la
acción (GET para leer, POST para crear, PATCH para modificar, DELETE para borrar) y un prefijo de
versión en la ruta.

Por qué importa. Una API predecible es más fácil de usar correctamente y de auditar. El versionado
permite cambiar la API en el futuro sin romper a los clientes que ya la usan, y ayuda a llevar un
inventario claro de qué endpoints existen.

Cómo se aplicó. Todas las rutas están bajo `/api/v1` (`src/app.js` y `src/routes/index.js`). Los
recursos son `/artists`, `/albums`, `/songs`, `/playlists`, `/player`, `/users` y `/admin`. Las
acciones sobre el usuario autenticado usan `/me`, por ejemplo `GET /playlists/me` o
`PATCH /users/me/plan`. Las listas están paginadas con `?page=` y `?limit=`.

### 2.3 Códigos HTTP correctos y formato uniforme de errores

Qué es. Responder con el código HTTP que corresponde a cada situación y devolver los errores siempre
con la misma estructura.

Por qué importa. Si cada error tiene un formato distinto, el cliente termina interpretando mal las
respuestas, y es más fácil que se escape información interna en algún caso no previsto. Un único
punto de manejo de errores también evita respuestas inconsistentes.

Cómo se aplicó. Los errores se lanzan con la clase `AppError` (`src/utils/AppError.js`), que lleva el
código HTTP y una lista de detalles. Todos llegan al middleware global `src/middlewares/errorHandler.js`,
que responde siempre `{ success: false, message, errors }`. Las rutas que no existen pasan por
`src/middlewares/notFound.js`. Se usan 201 al crear, 400 para datos inválidos, 401 sin autenticación,
403 sin permiso, 404 si no existe, 409 para duplicados y 429 cuando se supera un límite.

### 2.4 Contraseñas con bcrypt

Qué es. Guardar las contraseñas como un hash lento y con sal, nunca en texto plano ni con un hash
rápido como MD5 o SHA-1.

Por qué importa. Si alguien obtiene una copia de la base de datos, no debe poder leer las
contraseñas. Como mucha gente reutiliza contraseñas, una filtración puede afectar también otras
cuentas de los usuarios. bcrypt es lento a propósito, lo que hace muy costoso probar millones de
contraseñas.

Cómo se aplicó. En `src/services/auth.service.js` la contraseña se guarda con `bcrypt.hash` usando
10 rondas, y el login la compara con `bcrypt.compare`. Además, el validador de registro exige mínimo
8 caracteres, una mayúscula y un número (`src/validators/auth.validator.js`). Las consultas que
devuelven usuarios seleccionan explícitamente los campos públicos, por lo que la contraseña nunca
aparece en una respuesta. Las pruebas automáticas lo verifican.

### 2.5 JWT con access token y refresh token

Qué es. Después del login el servidor entrega dos tokens. El access token es de corta duración y se
envía en cada petición. El refresh token dura más y solo sirve para pedir un access token nuevo.

Por qué importa. Si un access token es robado, solo sirve durante poco tiempo. El usuario no tiene
que iniciar sesión cada 15 minutos porque el refresh token permite renovar la sesión, y este sí se
puede revocar desde el servidor.

Cómo se aplicó. En `src/utils/jwt.js` el access token se firma con `JWT_SECRET`, dura 15 minutos y
contiene `{ sub, role, plan }`. El refresh token se firma con otro secreto (`JWT_REFRESH_SECRET`),
dura 7 días y lleva un identificador único (`jti`). Al verificar se acepta únicamente el algoritmo
HS256, lo que evita aceptar tokens sin firma (`alg: none`). El middleware `src/middlewares/auth.js`
lee el header `Authorization: Bearer`, verifica el token y responde 401 si falta, si es inválido o si
expiró. Como cada tipo de token usa un secreto distinto, un refresh token no funciona como access
token ni al revés.

### 2.6 Rotación de refresh tokens, hash SHA-256 y detección de reutilización

Qué es. Tres medidas complementarias para proteger los refresh tokens. La rotación hace que cada
refresh token sirva una sola vez. El hash evita guardar el token real en la base de datos. La
detección de reutilización reacciona cuando alguien usa un token que ya había sido usado.

Por qué importa. El refresh token es la credencial más valiosa porque dura días. Si se guarda tal
cual, una filtración de la base de datos permitiría usar todas las sesiones. Y si un atacante roba un
refresh token, la rotación hace que tarde o temprano el atacante o el usuario legítimo usen un token
ya revocado, lo cual delata el robo.

Cómo se aplicó. En `src/services/auth.service.js`, la función `refresh` revoca el token recibido y
entrega un par nuevo. En la tabla `RefreshToken` solo se guarda el hash SHA-256 del token
(`hashToken` en `src/utils/jwt.js`). Si llega un token que ya estaba revocado, se revocan todas las
sesiones activas del usuario, se registra el evento `TOKEN_REUSE_DETECTED` en la auditoría y se
responde 401. La revocación usa una condición `revoked: false` para que dos peticiones simultáneas
con el mismo token no obtengan dos pares nuevos.

### 2.7 Control de acceso por roles y por propiedad del recurso

Qué es. Comprobar no solo que el usuario esté autenticado, sino también que su rol le permita usar
la función (control por función) y que el recurso que quiere modificar sea suyo (control por
objeto).

Por qué importa. Son los fallos más comunes en APIs. Sin control por objeto, basta con cambiar un id
en la URL para editar o borrar datos de otra persona. Sin control por función, un usuario normal
podría usar rutas de administración.

Cómo se aplicó. Hay tres roles: OYENTE, ARTISTA y ADMIN. El middleware `src/middlewares/roles.js`
(`authorize`) restringe rutas por rol, por ejemplo todo `/admin` es solo para ADMIN. La función
`checkOwnership` de `src/utils/ownership.js` comprueba que la canción o el álbum pertenezca al
artista autenticado; un ADMIN solo puede borrar contenido ajeno, no editarlo. Al crear álbumes o
canciones, el `artistId` siempre sale del token y nunca del body. Nadie puede registrarse como ADMIN
y un ADMIN no puede quitarse su propio rol (`src/services/admin.service.js`).

En las playlists (`src/services/playlist.service.js`), si alguien pide una playlist privada que no
es suya se responde 404 y no 403. Un 403 confirmaría que la playlist existe; con 404 no se revela
esa información.

### 2.8 Validación de entradas con zod

Qué es. Revisar todos los datos que llegan del cliente (body, parámetros de la URL y query) contra un
esquema que define tipos, formatos y rangos permitidos, antes de usarlos.

Por qué importa. Los datos del cliente no son confiables. Sin validación pueden llegar tipos
inesperados, valores fuera de rango, campos que el cliente no debería poder cambiar (asignación
masiva) o URLs peligrosas que después se muestran en un frontend.

Cómo se aplicó. Los esquemas están en `src/validators/` y el middleware genérico
`src/middlewares/validate.js` los aplica a body, params o query. Si falla, responde 400 indicando qué
campo y por qué. Algunos ejemplos: los ids de la URL deben ser enteros positivos, `limit` no puede
pasar de 50, el rol de registro solo puede ser OYENTE o ARTISTA y las URLs de audio y portada solo
aceptan http o https, con lo que se rechazan valores como `javascript:alert(1)`. Además zod descarta
los campos que no están en el esquema, así que enviar `artistId`, `plays` o `role` donde no
corresponde no tiene efecto.

### 2.9 Rate limiting

Qué es. Limitar cuántas peticiones puede hacer un cliente en un periodo de tiempo.

Por qué importa. Sin límite, un atacante puede probar miles de contraseñas por minuto contra el
login (fuerza bruta o credential stuffing).

Cómo se aplicó. En `src/middlewares/rateLimiter.js` el login acepta como máximo 5 intentos cada 15
minutos por IP; al superarlo responde 429 con el formato de error estándar y registra el evento
`RATE_LIMIT_EXCEEDED`. El límite se puede cambiar con `LOGIN_RATE_LIMIT_MAX`. Aparte, las reglas de
negocio de los planes también limitan el uso: un usuario FREE puede tener 3 playlists y saltar 6
canciones por hora (`src/utils/planLimits.js`). Esos límites son atómicos: la inserción y el conteo
se hacen en la misma transacción, por lo que dos peticiones simultáneas no pueden superarlos.

### 2.10 Cabeceras de seguridad con helmet y CSP

Qué es. Enviar cabeceras HTTP que le indican al navegador cómo protegerse, por ejemplo qué scripts
puede ejecutar (Content-Security-Policy) o que no adivine el tipo de contenido.

Por qué importa. Estas cabeceras reducen el impacto de ataques como XSS o clickjacking y ocultan
detalles del servidor, como la cabecera `X-Powered-By: Express`.

Cómo se aplicó. En `src/app.js` se usa `helmet()` para toda la API. La documentación Swagger necesitó
un ajuste: con la directiva `upgrade-insecure-requests` el navegador pedía los archivos por https y
la página quedaba en blanco al abrirla por la IP del equipo. En lugar de relajar la política para
toda la API, en `src/routes/docs.routes.js` se quitó esa única directiva y solo para `/api/docs`.
El resto de la API conserva la política completa.

### 2.11 CORS restringido

Qué es. CORS es el mecanismo con el que el servidor le dice al navegador qué sitios web pueden leer
sus respuestas.

Por qué importa. Si la API acepta cualquier origen, cualquier página web podría hacer peticiones a la
API desde el navegador de un usuario y leer las respuestas.

Cómo se aplicó. La lista de orígenes permitidos se lee de la variable `CORS_ORIGINS`
(`src/config/env.js`) y se pasa a `cors` en `src/app.js`. Por defecto solo se permite
`http://localhost:3000`. Un origen que no está en la lista no recibe la cabecera
`Access-Control-Allow-Origin`, por lo que el navegador bloquea la respuesta. Esto no reemplaza a la
autenticación: CORS solo lo aplican los navegadores, así que un cliente como curl puede seguir
llamando a la API, pero necesita un token válido.

### 2.12 Manejo de secretos con .env

Qué es. Mantener las contraseñas, claves y cadenas de conexión fuera del código fuente, en variables
de entorno.

Por qué importa. Un secreto escrito en el código termina en el repositorio y lo puede ver cualquiera
con acceso a él, incluso después de borrarlo, porque queda en el historial.

Cómo se aplicó. Los secretos JWT, la URL de la base de datos y la contraseña del administrador se
leen de `.env`, que está en `.gitignore`. El archivo `.env.example` tiene las mismas variables sin
valores secretos. `src/config/env.js` centraliza la lectura y detiene la aplicación si falta una
variable obligatoria. La contraseña del administrador no aparece en el README ni en la
documentación; el seed la toma de `ADMIN_PASSWORD`.

### 2.13 Mensajes de error que no filtran información

Qué es. Diseñar los mensajes de error para que ayuden al usuario legítimo sin darle pistas a un
atacante.

Por qué importa. Un mensaje como "el email no existe" permite averiguar qué cuentas están
registradas. Un error interno con el detalle de la base de datos revela la estructura del sistema.

Cómo se aplicó. El login responde siempre "Credenciales inválidas", sin decir si falló el email o la
contraseña (`src/services/auth.service.js`). Además, cuando el email no existe se compara la
contraseña contra un hash ficticio (`DUMMY_HASH`), para que el tiempo de respuesta sea parecido en
ambos casos y no se pueda distinguir midiéndolo. Los errores 500 responden "Error interno del
servidor" sin detalles, que solo se escriben en la consola del servidor
(`src/middlewares/errorHandler.js`). Las playlists privadas ajenas responden 404, como se explicó en
la sección 2.7.

### 2.14 Auditoría

Qué es. Registrar los eventos importantes de seguridad: quién hizo qué, cuándo y desde dónde.

Por qué importa. Sin registros no es posible detectar un ataque en curso ni investigar un incidente
después. Por ejemplo, muchos `LOGIN_FAILED` seguidos desde una misma IP indican un intento de fuerza
bruta.

Cómo se aplicó. El modelo `AuditLog` (`prisma/schema.prisma`) guarda el usuario, la acción, la IP,
el user-agent, detalles en JSON y la fecha. El servicio `src/services/audit.service.js` registra los
eventos LOGIN_SUCCESS, LOGIN_FAILED, TOKEN_REUSE_DETECTED, LOGOUT, PLAN_CHANGED, ROLE_CHANGED,
RESOURCE_DELETED (cuando un ADMIN borra contenido de otro artista) y RATE_LIMIT_EXCEEDED. En los
logins fallidos se guarda el email intentado, nunca la contraseña. Si el guardado falla, la petición
sigue funcionando y el error solo se escribe en consola, para que un problema en la auditoría no deje
sin servicio a la API. Los administradores consultan la bitácora en `GET /api/v1/admin/audit-logs`,
con filtros por acción y por usuario.

### 2.15 Documentación con Swagger deshabilitada en producción

Qué es. Mantener una documentación formal de la API (OpenAPI) y exponerla solo donde hace falta.

Por qué importa. La documentación facilita el uso correcto de la API y ayuda a llevar un inventario
de todos sus endpoints. Pero publicada en producción le entrega a un atacante el mapa completo de la
API, con parámetros y ejemplos.

Cómo se aplicó. La especificación está escrita a mano en `docs/openapi.yaml` y documenta los 33
endpoints, con roles, límites de plan, códigos de respuesta y ejemplos. Se sirve en `/api/docs` solo
si `NODE_ENV` no es `production` (`src/app.js`); en producción el módulo ni siquiera se carga y la
ruta responde 404. El script `npm run docs:validate` (`scripts/validate-openapi.js`) valida la
especificación y comprueba que todas las rutas de Express estén documentadas.

### 2.16 Pruebas automáticas

Qué es. Un conjunto de pruebas que se ejecutan con un comando y verifican que la API se comporta
como se espera, incluidos los controles de seguridad.

Por qué importa. Los controles de seguridad se pueden romper sin que nadie lo note al cambiar otra
parte del código. Las pruebas automáticas detectan esas regresiones antes de que lleguen a
producción.

Cómo se aplicó. La carpeta `tests/` tiene 100 pruebas con Jest y supertest, organizadas en `auth`,
`catalog`, `playlists`, `player`, `plans`, `admin`, `audit` y `security`. Usan una base de datos
aparte (`prisma/test.db`) que se recrea con las migraciones en cada ejecución. Cubren, entre otras
cosas, registro y login, rotación y reutilización de refresh tokens, tokens alterados, vencidos y sin
firma, los códigos 401, 403, 404, 409 y 429, la propiedad de los recursos, los límites FREE y
PREMIUM con peticiones simultáneas, que la contraseña nunca aparece en una respuesta, CORS, las
cabeceras de seguridad y los eventos de auditoría. La cobertura de sentencias es de alrededor del
98 %.

## 3. Relación con el OWASP API Security Top 10 (2023)

| Riesgo OWASP | Medidas en SonaGT | Estado |
|---|---|---|
| API1:2023 Broken Object Level Authorization | `checkOwnership` en canciones y álbumes; playlists solo modificables por su dueño; playlist privada ajena responde 404; historial y playlists filtrados por el usuario del token | Cubierto |
| API2:2023 Broken Authentication | bcrypt; JWT con algoritmo fijo y secretos distintos; access token corto; rotación, hash y detección de reutilización de refresh tokens; rate limit del login; mensaje de login genérico | Parcial: el rate limit es por IP y no por cuenta, no hay MFA y un access token no se puede revocar antes de que expire |
| API3:2023 Broken Object Property Level Authorization | zod descarta campos no permitidos (`artistId`, `plays`, `role`); las respuestas seleccionan solo campos públicos y nunca incluyen la contraseña | Cubierto |
| API4:2023 Unrestricted Resource Consumption | Paginación con máximo 50; rate limit del login; límites de plan atómicos; límite por defecto del body de `express.json` | Parcial: no hay límite de peticiones general fuera del login |
| API5:2023 Broken Function Level Authorization | Middleware `authorize` por rol; rutas `/admin` solo para ADMIN; no se puede registrar como ADMIN; un ADMIN no puede quitarse su rol | Cubierto |
| API6:2023 Unrestricted Access to Sensitive Business Flows | Límites de playlists y saltos para FREE; rate limit del login | Parcial: las reproducciones no tienen límite y un bot podría inflar el contador `plays` |
| API7:2023 Server Side Request Forgery | La API no descarga ni consulta las URLs que recibe; solo las guarda y valida que sean http o https | No aplica (riesgo bajo) |
| API8:2023 Security Misconfiguration | helmet y CSP; CORS restringido; errores 500 genéricos; Swagger deshabilitado en producción; secretos en `.env` | Parcial: no hay HTTPS en el servidor local |
| API9:2023 Improper Inventory Management | Versionado `/api/v1`; especificación OpenAPI completa y validada contra las rutas reales | Cubierto |
| API10:2023 Unsafe Consumption of APIs | La API no consume servicios de terceros | No aplica |

## 4. Limitaciones y mejoras futuras

HTTPS. El servidor funciona con http. En producción debería estar detrás de un proxy inverso con TLS
(por ejemplo Nginx) para que los tokens y contraseñas no viajen en texto claro.

Revocación de access tokens. Un access token sigue siendo válido hasta que expira, aunque el usuario
cambie de plan o un administrador le quite un rol. Se podría mantener una lista negra de
identificadores de token revocados, o consultar el rol y el plan en la base de datos en cada
petición, a cambio de más carga.

Base de datos de producción. SQLite es adecuado para el proyecto académico, pero no para muchos
usuarios simultáneos. Con PostgreSQL habría que adaptar la atomicidad de los límites de plan, por
ejemplo bloqueando la fila del usuario con `SELECT ... FOR UPDATE`, porque la solución actual depende
de que SQLite permite una sola escritura a la vez.

Rate limiting más completo. El contador del login está en memoria: se pierde al reiniciar el servidor
y no se comparte entre varias instancias. Se podría usar Redis, limitar también por cuenta además de
por IP y agregar un límite general para el resto de endpoints, incluido el de reproducciones.

Refresh token en cookie. Hoy el cliente recibe el refresh token en el cuerpo de la respuesta y debe
guardarlo. Enviarlo en una cookie `HttpOnly`, `Secure` y `SameSite` evitaría que un script malicioso
en el frontend lo pueda leer.

Auditoría. La bitácora no tiene política de retención ni protección contra modificaciones. Se podría
enviar a un sistema externo de logs y generar alertas automáticas, por ejemplo ante varios
TOKEN_REUSE_DETECTED seguidos.

Otras mejoras. Autenticación de dos factores para administradores, verificación del email al
registrarse, un proceso de integración continua que ejecute las pruebas en cada cambio y la revisión
periódica de dependencias con `npm audit`.

## 5. Conclusión

La seguridad de una API no depende de una sola medida, sino de varias capas que se complementan.
En SonaGT, la validación con zod impide que lleguen datos inesperados, la autenticación con JWT y la
rotación de refresh tokens protegen las sesiones, los controles de rol y de propiedad evitan que un
usuario acceda a lo que no le corresponde, y la auditoría permite saber qué pasó cuando algo falla.

El proyecto también muestra que estas prácticas no son difíciles de aplicar si se piensan desde el
inicio y se organizan en capas. Las pruebas automáticas ayudan a que se mantengan con el tiempo. Las
limitaciones de la sección 4 indican los siguientes pasos para llevar la API a un entorno de
producción real.

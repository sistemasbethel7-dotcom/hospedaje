# Hospedaje (Anfitriones)

PWA + Dashboard para gestionar la distribución de hogares anfitriones durante eventos masivos de la
congregación (el primero: el Centenario). Agentes registran casas y llegadas desde el celular en campo;
administradores y supervisores controlan todo desde un dashboard de escritorio con métricas, mapa en vivo
y un agente de voz con IA para consultar datos hablando.

**Estado actual:** en producción, con un evento real en curso. https://lldmhospedaje.tech

**Manual para el cliente (no técnico):** `documentos/Manual del Sistema Anfitriones (MVP).pdf`

---

## Stack

- **Backend:** Node.js + Express (ESM), PostgreSQL (`pg`), JWT (`jsonwebtoken`) + `bcryptjs`, `multer` para
  fotos, `cors`. Sin ORM — SQL directo.
- **Frontend:** Vanilla JS (ES modules), **sin build step** — cada página es un `.html` + un `<script type="module">`
  en `js/pages/`. PWA (manifest + service worker). Chart.js y Leaflet se cargan vía CDN, no como dependencias npm.
  El área `admin/` es una mini-SPA propia (`js/router.js` + `js/adminShell.js`, ver Estructura) — el resto del
  sitio (modo campo) navega normal con recarga completa.
- **Servicios externos:** OpenAI Realtime API (agente de voz del dashboard, WebRTC directo navegador↔OpenAI,
  requiere `OPENAI_API_KEY`) y Resend (correos de invitación de usuarios, requiere `RESEND_API_KEY` /
  `RESEND_FROM_EMAIL`). Ver Deploy → Variables de entorno.
- **Hosting:** VPS Hostinger (Ubuntu), Nginx (sirve `frontend/` como estático, proxy de `/api` y `/uploads` a
  Node), PM2 (`hospedaje-api`), Postgres local, SSL Let's Encrypt.

## Estructura

```
backend/src/
  routes/         → controllers/ → services/  (capas: ruta valida entrada, controller orquesta, service hace SQL)
  middleware/     asyncHandler, requireAuth, requireRole, upload (multer)
  db/schema.sql   idempotente — se puede re-correr sin romper nada (ver sección Deploy)
  db/codigos_postales.csv.gz  catálogo SEPOMEX (se importa con backend/scripts/import-codigos-postales.js)

frontend/
  *.html + js/pages/*.js     → flujo "modo campo" (agente): login, elegir evento, home, registro, ingresos,
                                hogares, tutorial-instalacion.html (instalar la PWA, no enlazada desde
                                ningún menú — se comparte la URL directo)
  admin/*.html + js/pages/admin-*.js  → dashboard desktop-first (admin/supervisor), navega como SPA:
                                js/router.js intercepta clicks del sidebar y reemplaza solo <main
                                class="admin-main"> vía fetch+DOMParser (con fallback a navegación real si
                                algo falla); js/adminShell.js (mountShellOnce) monta una sola vez el sidebar,
                                el logout y el agente de voz flotante sin importar por qué página se entró.
  js/agentClient.js / agentPanel.js   agente de voz IA: cliente WebRTC + esfera de partículas animada
  css/            un archivo por página + tokens.css (design system) + components.css (compartido)
  service-worker.js  cache-first con fallback, PERO fetch con {cache:'no-cache'} (ver Lecciones aprendidas)

documentos/       manual PDF para el cliente (no versionar más PDFs pesados sin necesidad)
```

## Roles

- **admin** — acceso total: eventos, catálogos, usuarios, dashboard, mapa, configurar el agente de voz.
- **agente** — registra hogares e ingresos en campo. Entra a `eventos.html` → `home.html` (modo campo).
- **supervisor** — ve dashboard/mapa/eventos, no administra catálogos ni usuarios. Entra directo al dashboard.

Login → admin y supervisor van directo a `admin/dashboard.html`; agente va a `eventos.html`/`home.html`.

> **Ojo con el nombre:** el rol `agente` (personal de campo que registra casas) y el **"agente de voz IA"**
> del dashboard (ver Funcionalidades) son conceptos completamente distintos que comparten palabra por
> coincidencia — no confundirlos al leer código o commits.

## Modelo de datos (Postgres)

- **usuarios** — email, password_hash (NULL mientras la cuenta está pendiente de activar por invitación),
  role (admin/agente/supervisor), activo, nombre/telefono (opcionales), setup_token_hash +
  setup_token_expires (invitación por correo de un solo uso, 48h — ver Funcionalidades). El estado
  "pendiente" no es una columna, se calcula en la consulta (`password_hash IS NULL`).
- **eventos** — nombre, sede, fecha_inicio, fecha_fin, estatus (abierto/finalizado), creado_por
- **hogares** — evento_id, nombre_dueno, calle_numero, colonia, codigo_postal, referencias, lat/lng,
  capacidad, ocupacion_actual, tenencia (CHECK 'Propia'|'Rentada', NULL en registros previos al campo),
  comentarios, folio_anterior (folio del sistema de origen en importaciones, ej. MIRH-123; solo lectura
  en la UI), foto_dueno (columna y endpoint siguen aceptándola, pero **ya no se pide ni se muestra en
  ninguna UI** — solo queda `foto_fachada` activa), foto_fachada, **servicios[]**, vulnerabilidades[],
  notas_vulnerabilidad, perfil_sugerido[], registrado_por, posible_duplicado_de (FK a otro hogar; marca
  informativa de posible duplicado, ver Funcionalidades).
- **ingresos** — hogar_id, cantidad, registrado_por (historial de llegadas; ocupacion_actual en hogares es
  el acumulado, con `SELECT ... FOR UPDATE OF h` para evitar condiciones de carrera)
- **catalogos** — tipo (servicio/vulnerabilidad/perfil), etiqueta, orden, activo. **Global**, no por evento
  (decisión explícita del usuario). `servicios`/`vulnerabilidades`/`perfil_sugerido` en `hogares` guardan
  snapshots de etiquetas (texto), no referencias — borrar/desactivar un catálogo no afecta registros viejos.
- **codigos_postales** — catálogo SEPOMEX local (cp, colonia, tipo_asentamiento, municipio, estado) para
  autocompletar colonia/estado sin depender de una API externa.
- **agente_config** — fila única (id fijo = 1): habilitado, voz, acento_estilo. Config del agente de voz IA.

## Funcionalidades implementadas

- **Auth**: JWT (30 días, sin revocación — desactivar un usuario bloquea logins nuevos pero no invalida
  tokens ya emitidos), roles, cuentas activas/inactivas.
- **Alta de usuarios por invitación por correo**: el admin crea el usuario sin password; se genera un token
  de un solo uso (se guarda solo su hash SHA-256, expira a las 48h) y se manda por correo vía **Resend** un
  link a `set-password.html` para que el usuario defina su propia contraseña (login automático al terminar).
  Si el envío de correo falla, el usuario queda creado igual con aviso de "reenviar invitación".
- **Multi-evento**: varios eventos abiertos a la vez, cada uno con su propio set de hogares/ingresos. Evento
  activo se guarda en `localStorage` del navegador (no en el JWT).
- **Wizard de registro de hogares** (6 pasos, una sola página con estado en JS + autoguardado de borrador en
  localStorage): datos del dueño + ubicación en mapa (Leaflet/Esri), fotos, capacidad (input numérico
  editable, tope 500, selecciona el valor al enfocar), servicios/vulnerabilidades/perfil (**catálogos
  dinámicos**, cargados desde `/api/catalogos/activos`, ya no hardcodeados). Código postal autocompleta
  colonia/estado contra el catálogo local de SEPOMEX.
- **Detección de hogares duplicados**: al crear un hogar, el backend busca coincidencias por mismo teléfono
  o misma calle+colonia dentro del evento; si encuentra alguna responde 409 con la lista y el wizard muestra
  un modal para que el agente confirme ("sí es otra casa", `forzar_duplicado=true`) o corrija — no bloquea,
  solo advierte. Los hogares ya duplicados quedan marcados (`posible_duplicado_de`, se recalcula solo cada
  vez que se corre `schema.sql`) y `admin/hogares.html` los filtra con un badge para revisarlos a mano.
- **Ingresos** (check-in de personas): mismo patrón de card con foto que "hogares", cantidad editable con
  tope según lugares disponibles.
- **Compresión de imágenes** en el navegador antes de subir (`js/imageCompress.js`, canvas → 1600px/JPEG 0.8)
  — evita fallos de subida en redes de campo lentas.
- **Dashboard admin** (desktop-first, `admin/dashboard.html`): KPIs + gráficas Chart.js (ocupación, por
  colonia, servicios/vulnerabilidades/perfil, y casas registradas por cada agente de campo — excluyendo
  altas hechas por cuentas admin, ej. importaciones) con paleta de colores vivos — **excepto** la gráfica de
  Ocupación, que usa semáforo real (verde/rojo) porque ahí el color es información de estatus, no decoración.
  Cada tarjeta de KPI abre un modal **solo de lectura** con el desglose de hogares de esa categoría; el clic
  en una fila lleva al detalle de esa casa también en solo lectura (`?soloLectura=1`, oculta editar/eliminar)
  — la edición real vive únicamente en la sección Hogares. Las fotos del modal abren en un lightbox a pantalla
  completa.
- **Tiempo real (SSE)**: `GET /api/eventos/:id/stream` — el backend emite un evento (`eventBus`, EventEmitter
  en memoria, un solo proceso PM2) cada vez que se crea/edita/elimina un hogar o se registra un ingreso; el
  dashboard y el mapa se refrescan solos, con indicador "En vivo". `EventSource` no manda headers, así que
  esa ruta se autentica con el token por query string (`requireAuthQuery`), solo ahí.
- **Mapa visual** (`admin/mapa.html`): cada hogar con lat/lng como marcador Leaflet coloreado por estatus
  (verde libre / amarillo parcial / rojo lleno, semáforo real). Hogares sin ubicación (el pin es opcional)
  se cuentan aparte, no desaparecen.
- **Sección Hogares del admin** (`admin/hogares.html`): tabla completa de hogares del evento activo, con
  filtros en vivo (dueño/colonia/calle/código postal, del lado del cliente) y badge de estatus
  (libre/parcial/lleno, mismo semáforo que el mapa) y de posible duplicado. Contador de resultados siempre
  visible (refleja el total filtrado). Resultados en bloques de 25 con paginación arriba a la derecha de la
  tabla. La tabla tiene ancho de columnas fijo y dos barras de scroll horizontal visibles y sincronizadas
  (una justo bajo los títulos, otra al fondo) para dejar claro que hay más columnas hacia la derecha en
  pantallas angostas. "Ver detalle" abre `hogar-detalle.html` con edición/eliminación completas para admin
  (para supervisor, solo lectura — mismo control de rol que ya existía en esa página); "Eliminar" en la
  tabla solo aparece para admin. Los KPIs del dashboard abren un modal **solo de lectura** — para editar o
  eliminar, el flujo correcto es siempre esta sección, no el modal.
- **Catálogos configurables** (`admin/catalogos.html`): admin agrega/activa-desactiva/elimina los elementos
  de Servicios, Vulnerabilidades y Perfil recomendado.
- **Gestión de usuarios**: crear (por invitación), cambiar rol, activar/desactivar, restablecer contraseña.
- **Gestión de eventos**: crear, finalizar/reabrir (bloquea altas nuevas con 409, validado en backend).
- **Agente de voz IA** (`admin/agente.html` para configurar; orbe flotante disponible en todo el admin para
  admin/supervisor si está habilitado): conecta por **WebRTC directo entre el navegador y OpenAI Realtime**
  (`gpt-realtime-mini`) — el backend solo emite un `client_secret` efímero (`POST /api/agente/token`), el
  audio nunca pasa por el servidor de Hospedaje. Solo voz (el modo texto se probó y se quitó). Puede
  consultar hogares por dueño/calle/colonia/disponibilidad, dar métricas del evento, capacidad/disponibilidad
  agrupada por calle (aproximada con una regex sobre `calle_numero`, no hay campo de calle separado),
  distancia de cada hogar al templo (Haversine sobre coordenadas fijas en `agentClient.js`), abrir el detalle
  de un hogar o una lista de resultados en un modal flotante propio, y navegar el SPA a otra sección — nunca
  crea, edita ni elimina nada (restricción explícita en el prompt). Configuración (habilitado/voz/estilo)
  persistida en `agente_config`, editable solo por admin.

## Deploy

```bash
./deploy.sh   # git pull + npm install --omit=dev + pm2 restart, en el VPS
```

**Importante — `deploy.sh` NO aplica `backend/src/db/schema.sql` solo.** Cada vez que ese archivo cambie
(nueva tabla/columna), correrlo a mano contra producción (el archivo es idempotente, se puede re-correr
sin romper nada):

```bash
ssh -i ~/.ssh/id_ed25519_pwa_templo bAdmin@46.202.88.39 \
  'echo "<sudo_password>" | sudo -S -u postgres psql -d pwa_templo -f /home/bAdmin/hospedaje/backend/src/db/schema.sql'
# luego: pm2 restart hospedaje-api
```

**Variables de entorno** (`backend/.env` en el VPS, no versionado): `DATABASE_URL`, `JWT_SECRET`,
`FRONTEND_URL` (para los links del correo de invitación), `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (correos de
invitación — si faltan, ese flujo falla), `OPENAI_API_KEY` (agente de voz — si falta, `POST /api/agente/token`
responde 500, el resto de la app funciona igual).

Credenciales reales (SSH, sudo, DB, JWT_SECRET, API keys) están en `vps-credentials.json` (gitignored, no se
sube). No hay entorno de desarrollo local montado — el flujo de trabajo de este proyecto es desarrollar y
probar directo contra producción (ver más abajo).

## Cómo se ha trabajado en este proyecto (para continuar sin perder el hilo)

- **No hay ambiente local**: los cambios se prueban con Playwright o curl directo contra
  `https://lldmhospedaje.tech`, creando datos de prueba con nombres reconocibles (`TEST E2E ...`) y
  limpiándolos por SQL directo al terminar. **Cuidado**: ya existe al menos un evento y hogares reales
  cargados por el cliente — siempre verificar el estado de la base antes de asumir que está vacía, y nunca
  tocar filas que uno mismo no creó en esa sesión.
- **`node --check archivo.js`** antes de cada deploy (no hay test suite todavía).
- **Bump del `CACHE_NAME`** en `service-worker.js` en cada deploy que toque frontend, y agregar archivos
  nuevos al `APP_SHELL`.
- **Bug recurrente ya corregido varias veces**: adjuntar el listener de un botón *después* de un `await` de
  nivel superior (ej. validar sesión/rol) hace que un clic rápido antes de que resuelva se pierda en
  silencio. Patrón correcto: todos los listeners se adjuntan de forma síncrona al cargar el script; el
  bloque async solo decide visibilidad/contenido, nunca adjunta listeners nuevos.
- **El service worker debe usar `fetch(request, {cache:'no-cache'})`**, no `fetch(request)` a secas —
  si no, el navegador puede servir una copia vieja de disco sin preguntarle al servidor, aunque la
  estrategia sea "network-first" (nginx no manda `Cache-Control`).
- **Playwright + `waitUntil:'networkidle'`** nunca resuelve en páginas con SSE abierto (dashboard, mapa) —
  usar `waitUntil:'load'` + `waitForTimeout` en esas páginas.
- **Tablas con ancho de columna fijo (`table-layout:fixed`)**: si una celda necesita más espacio del que le
  toca (ej. varios botones de acción), el sobrante se desborda visualmente pero **no** cuenta para el
  `scrollWidth` del contenedor — el scroll parece "no llegar" al final. Hay que calcular el ancho mínimo real
  del contenido (botones + gaps + padding) al fijar anchos de columna.

## Pendiente / posibles siguientes pasos

- Sincronización offline real (hoy solo se detecta "sin conexión", no hay cola de reintento automático).
- Notificaciones automáticas ante casos que necesiten atención.
- `tutorial-instalacion.html` no está enlazado desde ningún menú del sitio (solo se llega por URL directa,
  compartida manualmente) — confirmar con el cliente si eso es intencional o falta enlazarlo desde algún lado
  (ej. `home.html`).

## Referencia rápida

- Repo: `sistemasbethel7-dotcom/hospedaje` en GitHub.
- Dominio: `lldmhospedaje.tech` (+ www), SSL Let's Encrypt.
- VPS: Hostinger KVM1, Ubuntu, IP `46.202.88.39`, usuario `bAdmin` (sudo, solo llave SSH).

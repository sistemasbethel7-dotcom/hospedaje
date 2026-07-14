# Hospedaje (Anfitriones)

PWA + Dashboard para gestionar la distribución de hogares anfitriones durante eventos masivos de la
congregación (el primero: el Centenario). Agentes registran casas y llegadas desde el celular en campo;
administradores y supervisores controlan todo desde un dashboard de escritorio con métricas y mapa en vivo.

**Estado actual:** en producción, con un evento real en curso. https://lldmhospedaje.tech

**Manual para el cliente (no técnico):** `documentos/Manual del Sistema Anfitriones (MVP).pdf`

---

## Stack

- **Backend:** Node.js + Express (ESM), PostgreSQL (`pg`), JWT (`jsonwebtoken`) + `bcryptjs`, `multer` para
  fotos, `cors`. Sin ORM — SQL directo.
- **Frontend:** Vanilla JS (ES modules), **sin build step** — cada página es un `.html` + un `<script type="module">`
  en `js/pages/`. PWA (manifest + service worker). Chart.js y Leaflet se cargan vía CDN, no como dependencias npm.
- **Hosting:** VPS Hostinger (Ubuntu), Nginx (sirve `frontend/` como estático, proxy de `/api` y `/uploads` a
  Node), PM2 (`hospedaje-api`), Postgres local, SSL Let's Encrypt.

## Estructura

```
backend/src/
  routes/         → controllers/ → services/  (capas: ruta valida entrada, controller orquesta, service hace SQL)
  middleware/     asyncHandler, requireAuth, requireRole, upload (multer)
  db/schema.sql   idempotente — se puede re-correr sin romper nada (ver sección Deploy)

frontend/
  *.html + js/pages/*.js     → flujo "modo campo" (agente): login, elegir evento, home, registro, ingresos, hogares
  admin/*.html + js/pages/admin-*.js  → dashboard desktop-first (admin/supervisor)
  css/            un archivo por página + tokens.css (design system) + components.css (compartido)
  service-worker.js  cache-first con fallback, PERO fetch con {cache:'no-cache'} (ver Lecciones aprendidas)

documentos/       manual PDF para el cliente (no versionar más PDFs pesados sin necesidad)
```

## Roles

- **admin** — acceso total: eventos, catálogos, usuarios, dashboard, mapa.
- **agente** — registra hogares e ingresos en campo. Entra a `eventos.html` → `home.html` (modo campo).
- **supervisor** — ve dashboard/mapa/eventos, no administra catálogos ni usuarios. Entra directo al dashboard.

Login → admin y supervisor van directo a `admin/dashboard.html`; agente va a `eventos.html`/`home.html`.

## Modelo de datos (Postgres)

- **usuarios** — email, password_hash, role (admin/agente/supervisor), activo
- **eventos** — nombre, sede, fecha_inicio, fecha_fin, estatus (abierto/finalizado), creado_por
- **hogares** — evento_id, nombre_dueno, calle_numero, colonia, codigo_postal, referencias, lat/lng,
  capacidad, ocupacion_actual, tenencia (CHECK 'Propia'|'Rentada', NULL en registros previos al campo),
  comentarios, folio_anterior (folio del sistema de origen en importaciones, ej. MIRH-123; solo lectura
  en la UI), foto_dueno, foto_fachada, **servicios[]**, vulnerabilidades[], notas_vulnerabilidad,
  perfil_sugerido[], registrado_por
- **ingresos** — hogar_id, cantidad, registrado_por (historial de llegadas; ocupacion_actual en hogares es
  el acumulado, con `SELECT ... FOR UPDATE OF h` para evitar condiciones de carrera)
- **catalogos** — tipo (servicio/vulnerabilidad/perfil), etiqueta, orden, activo. **Global**, no por evento
  (decisión explícita del usuario). `servicios`/`vulnerabilidades`/`perfil_sugerido` en `hogares` guardan
  snapshots de etiquetas (texto), no referencias — borrar/desactivar un catálogo no afecta registros viejos.

## Funcionalidades implementadas

- **Auth**: JWT (30 días, sin revocación — desactivar un usuario bloquea logins nuevos pero no invalida
  tokens ya emitidos), roles, cuentas activas/inactivas.
- **Multi-evento**: varios eventos abiertos a la vez, cada uno con su propio set de hogares/ingresos. Evento
  activo se guarda en `localStorage` del navegador (no en el JWT).
- **Wizard de registro de hogares** (6 pasos, una sola página con estado en JS + autoguardado de borrador en
  localStorage): datos del dueño + ubicación en mapa (Leaflet/Esri), fotos, capacidad (input numérico
  editable, tope 500, selecciona el valor al enfocar), servicios/vulnerabilidades/perfil (**catálogos
  dinámicos**, cargados desde `/api/catalogos/activos`, ya no hardcodeados).
- **Ingresos** (check-in de personas): mismo patrón de card con foto que "hogares", cantidad editable con
  tope según lugares disponibles.
- **Compresión de imágenes** en el navegador antes de subir (`js/imageCompress.js`, canvas → 1600px/JPEG 0.8)
  — evita fallos de subida en redes de campo lentas.
- **Dashboard admin** (desktop-first, `admin/dashboard.html`): KPIs + 5 gráficas Chart.js con paleta de
  colores vivos (azul/morado/rosa/naranja/cian/amarillo/verde/rojo) — **excepto** la gráfica de Ocupación,
  que usa semáforo real (verde/rojo) porque ahí el color es información de estatus, no decoración. Cada
  tarjeta de KPI abre un modal **solo de lectura** con el desglose de hogares de esa categoría; el clic en
  una fila lleva al detalle de esa casa también en solo lectura (`?soloLectura=1`, oculta editar/eliminar) —
  la edición real vive únicamente en la sección Hogares.
- **Tiempo real (SSE)**: `GET /api/eventos/:id/stream` — el backend emite un evento (`eventBus`, EventEmitter
  en memoria, un solo proceso PM2) cada vez que se crea/edita/elimina un hogar o se registra un ingreso; el
  dashboard y el mapa se refrescan solos, con indicador "En vivo". `EventSource` no manda headers, así que
  esa ruta se autentica con el token por query string (`requireAuthQuery`), solo ahí.
- **Mapa visual** (`admin/mapa.html`): cada hogar con lat/lng como marcador Leaflet coloreado por estatus
  (verde libre / amarillo parcial / rojo lleno, semáforo real). Hogares sin ubicación (el pin es opcional)
  se cuentan aparte, no desaparecen.
- **Sección Hogares del admin** (`admin/hogares.html`): tabla completa de hogares del evento activo, con
  filtros en vivo (colonia/calle/código postal, del lado del cliente) y badge de estatus (libre/parcial/lleno,
  mismo semáforo que el mapa). "Ver detalle" abre `hogar-detalle.html` con edición/eliminación completas para
  admin (para supervisor, solo lectura — mismo control de rol que ya existía en esa página); "Eliminar" en la
  tabla solo aparece para admin. Los KPIs del dashboard (ver siguiente punto) abren un modal **solo de
  lectura** — para editar o eliminar, el flujo correcto es siempre esta sección, no el modal.
- **Catálogos configurables** (`admin/catalogos.html`): admin agrega/activa-desactiva/elimina los elementos
  de Servicios, Vulnerabilidades y Perfil recomendado.
- **Gestión de usuarios**: crear, cambiar rol, activar/desactivar, restablecer contraseña.
- **Gestión de eventos**: crear, finalizar/reabrir (bloquea altas nuevas con 409, validado en backend).

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

Credenciales reales (SSH, sudo, DB, JWT_SECRET) están en `vps-credentials.json` (gitignored, no se sube).
No hay entorno de desarrollo local montado — el flujo de trabajo de este proyecto es desarrollar y probar
directo contra producción (ver más abajo).

## Cómo se ha trabajado en este proyecto (para continuar sin perder el hilo)

- **No hay ambiente local**: los cambios se prueban con Playwright directo contra
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

## Pendiente / posibles siguientes pasos

- Autocompletar colonia a partir del código postal (base de datos oficial de Correos de México/SEPOMEX,
  importada localmente — no depender de una API externa el día del evento).
- Filtros de búsqueda de hogares por colonia/calle/código postal (la estructura de datos ya existe).
- Sincronización offline real (hoy solo se detecta "sin conexión", no hay cola de reintento automático).
- Notificaciones automáticas ante casos que necesiten atención.

## Referencia rápida

- Repo: `sistemasbethel7-dotcom/hospedaje` en GitHub.
- Dominio: `lldmhospedaje.tech` (+ www), SSL Let's Encrypt.
- VPS: Hostinger KVM1, Ubuntu, IP `46.202.88.39`, usuario `bAdmin` (sudo, solo llave SSH).

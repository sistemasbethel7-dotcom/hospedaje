# Plan: Main al 100% + Agente flotante con modo Texto/Voz

Plan de implementación para ejecutarse tal cual. Leer completo antes de tocar código.

## Contexto actual (verificado en el código)

- El agente de voz vive en una columna derecha: `<div class="agent-column" id="agent-column"></div>` presente en los **8** HTML de `frontend/admin/` (dashboard, hogares, mapa, eventos, evento-nuevo, usuarios, catalogos, agente).
- `frontend/js/adminShell.js` → `mountShellOnce()` llama `setupAgentPanel({ onNavegarPagina: navigate })` **una sola vez por carga de página**. El router SPA solo reemplaza los hijos de `.admin-main`, así que todo lo que se monte fuera de `.admin-main` (body) sobrevive la navegación SPA. No hay que re-montar nada al navegar.
- `frontend/js/agentPanel.js`: crea el orbe (canvas 360×360 con esfera de puntos), el texto de estatus, y un modal de vista previa (`admin-modal-backdrop stacked`) que appendea a `document.body`. Estados: `dormido | conectando | activo`. `despertar()`/`dormir()` manejan la sesión.
- `frontend/js/agentClient.js` → `iniciarSesionAgente(...)`: pide client_secret al backend (`obtenerTokenAgente`), abre `RTCPeerConnection` contra `https://api.openai.com/v1/realtime/calls?model=gpt-realtime-mini`, agrega el micrófono, y maneja un data channel `oai-events` donde ejecuta las tool calls (`buscar_hogares`, `metricas_evento`, `disponibilidad_por_calle`, `abrir_hogar`, `mostrar_lista_hogares`, `navegar_a_pagina`) al recibir `response.done`.
- Backend `backend/src/controllers/agenteController.js` → `POST /api/agente/token` crea el client_secret con instrucciones + tools. **No requiere cambios**: la misma sesión Realtime sirve para texto (el cliente decide la modalidad de salida por `response.create`).
- CSS: `frontend/css/agent.css` (`.agent-column`, orbe, y un media query que **oculta el agente por completo en <1100px**). `frontend/css/admin.css`: `.admin-main { flex: 0 1 1200px; max-width: 1200px; }`, `.admin-shell { display:flex }`. Z-index existentes: `.admin-modal-backdrop` = 100, `.stacked` = 110, lightbox = 200.
- Service worker: `frontend/service-worker.js`, `CACHE_NAME` actual = `anfitriones-v64`.

## Objetivo

1. `.admin-main` ocupa el 100% del ancho restante (sidebar fija de 240px, main todo lo demás, sin cortarse).
2. El agente deja la columna derecha y pasa a un **botón flotante (FAB)** en la esquina inferior derecha. Al pulsarlo muestra 2 opciones: **Texto** y **Voz**.
   - **Voz**: abre un panel flotante con el orbe actual (misma experiencia de hoy, solo reubicada).
   - **Texto**: abre un panel de chat para escribirle al agente, con las mismas herramientas/capacidades.

## Restricciones del proyecto (obligatorias)

- No hay build step: vanilla JS con módulos ES, editar archivos directamente.
- **No crear archivos JS/CSS nuevos**: todo cabe en `agentPanel.js`, `agentClient.js` y `agent.css`. Así no hay que tocar `APP_SHELL` del service worker.
- Al terminar: subir `CACHE_NAME` a `anfitriones-v65` y correr `node --check` sobre cada JS modificado.
- Listeners deben engancharse de forma síncrona antes de cualquier `await` (lección aprendida del proyecto).
- Existe una regla global `[hidden] { display: none !important; }` — usar `hidden` para mostrar/ocultar está bien.

---

## Fase 1 — Main al 100%

1. **Quitar la columna del agente de los 8 HTML** de `frontend/admin/`: eliminar la línea `<div class="agent-column" id="agent-column"></div>` (está justo después de `</main>` en cada uno). Verificar con `grep -rn "agent-column" frontend/admin/` que quede en cero.
2. **`frontend/css/admin.css`** — `.admin-main` pasa a ocupar todo el resto:
   ```css
   .admin-main {
     flex: 1 1 auto;
     min-width: 0;
     padding: 36px 44px;
   }
   ```
   (se elimina `max-width: 1200px` y el flex-basis de 1200px; conservar el bloque responsive de `@media (max-width: 860px)` tal como está).
3. **`frontend/css/agent.css`** — eliminar el bloque `.agent-column { ... }` y el `@media (max-width: 1100px)` que lo ocultaba. El resto (orbe, glow, canvas, status) se conserva porque se reutiliza en el panel de voz.

## Fase 2 — FAB + menú de 2 opciones

Todo en `frontend/js/agentPanel.js` (reescribir `crearDOM()`; `setupAgentPanel()` conserva su firma y el gate de `obtenerConfigAgente` → si `!config.habilitado`, no se monta nada).

1. Montar en `document.body` (ya no existe `#agent-column`) un contenedor fijo:
   ```html
   <div class="agent-fab-root">
     <div class="agent-menu" hidden>
       <button type="button" class="agent-menu-btn" data-modo="texto">💬 Texto</button>
       <button type="button" class="agent-menu-btn" data-modo="voz">🎤 Voz</button>
     </div>
     <button type="button" class="agent-fab" aria-label="Asistente">✦</button>
   </div>
   ```
   - `.agent-fab-root`: `position: fixed; right: 20px; bottom: 20px; z-index: 90;` (debajo de los modales que están en 100/110/200 — correcto: el modal de vista previa del agente debe tapar los paneles).
   - `.agent-fab`: círculo ~56px, fondo dorado del tema (`var(--color-gold-deep)` o el tint que mejor combine con `tokens.css`), sombra suave, cursor pointer.
   - Click en el FAB: alterna el menú. Si hay un panel abierto (voz o texto), el click del FAB lo cierra en lugar de abrir el menú.
   - El menú son 2 botones apilados que aparecen arriba del FAB.
2. **Visible en todos los tamaños de pantalla** (antes el agente desaparecía en <1100px; ahora el FAB cabe en móvil). Los paneles usan `max-width: calc(100vw - 32px)` para no desbordar en móvil.
3. Comportamiento de exclusión: abrir Voz cierra el panel de Texto y viceversa. Cerrar el panel de Voz (o cambiar a Texto) debe llamar `dormir()` para cortar la sesión WebRTC y liberar el micrófono. El panel de texto al cerrarse también cierra su sesión (ver Fase 4).

## Fase 3 — Panel de Voz (orbe reubicado)

1. Panel flotante anclado arriba del FAB: card con borde/sombra del tema, ~300px de ancho, contiene el mismo markup del orbe actual (`.agent-orb-inner` + canvas + `.agent-status`) y un botón de cerrar (×) en la esquina.
2. Reusar sin cambios la lógica existente: `despertar()`, `dormir()`, `dibujar()`, `fibonacciEsfera()`. El canvas puede quedarse en 360×360 (se escala por CSS al ancho del panel).
3. Al abrir el panel de voz, llamar `despertar()` directamente (ya no hace falta el paso "toca la esfera"); el click sobre el orbe sigue alternando dormir/despertar como hoy. Al cerrar el panel: `dormir()`.
4. El modal de vista previa de hogares (`crearModalVistaPrevia`, `mostrarVistaPreviaHogar`, `mostrarListaHogares`) queda igual: es compartido por ambos modos.

## Fase 4 — Panel de Texto + cliente Realtime en modo texto

### 4a. `frontend/js/agentClient.js`

Refactor para compartir la tubería de tools entre voz y texto:

1. Extraer el handler del data channel (parse del evento, manejo de `error`, loop de `function_call` en `response.done`) a una función interna reutilizable.
2. Nueva export `iniciarSesionAgenteTexto({ token, eventoId, onTexto, onRespuestaTerminada, onError, onMostrarVistaPrevia, onNavegarPagina, onMostrarListaHogares })`:
   - Mismo flujo de client_secret + `RTCPeerConnection` + fetch SDP a `https://api.openai.com/v1/realtime/calls?model=gpt-realtime-mini`, **pero sin** `getUserMedia`, sin `pc.addTrack`, sin `Audio()`, sin medición de niveles. Solo el data channel `oai-events`. (WebRTC con solo data channel es válido; si la oferta SDP fallara por no tener media, fallback: `pc.addTransceiver('audio', { direction: 'recvonly' })` antes de `createOffer` y simplemente no conectar el audio a nada.)
   - Además del manejo compartido de tools, escuchar deltas de texto: eventos `response.output_text.delta` (nombre GA) **y** `response.text.delta` (nombre beta) → pasar `evento.delta` a `onTexto`. En `response.done`, avisar `onRespuestaTerminada()`.
   - Devuelve `{ enviarTexto(texto), cerrar() }`. `enviarTexto` espera a que `dc.readyState === 'open'` y manda:
     ```js
     dc.send(JSON.stringify({
       type: 'conversation.item.create',
       item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: texto }] },
     }));
     dc.send(JSON.stringify({ type: 'response.create', response: { output_modalities: ['text'] } }));
     ```
   - **Importante**: en el loop compartido de tools, el `response.create` que se manda después de entregar los `function_call_output` debe incluir `response: { output_modalities: ['text'] }` cuando la sesión es de texto (parametrizar el handler con el modo). En voz se queda como está (`{ type: 'response.create' }`).
   - Si `output_modalities` fuera rechazado por la API (evento `error` mencionando el campo), reintentar con el nombre beta `modalities: ['text']`. Dejar el que funcione.
3. `iniciarSesionAgente` (voz) queda funcionalmente idéntica, solo usando el handler compartido.

### 4b. Panel de chat en `agentPanel.js`

1. Card flotante anclada arriba del FAB (~360px ancho, ~480px alto máx):
   - Header: título "Asistente" + botón cerrar.
   - Cuerpo scrolleable de mensajes: burbujas usuario (derecha, fondo dorado tint) / agente (izquierda, fondo suave). Los mensajes del agente se van llenando con los deltas (streaming).
   - Footer: `<input>` + botón enviar. Enter envía. Deshabilitar input/botón mientras hay una respuesta en curso (`onRespuestaTerminada` lo re-habilita).
2. La sesión de texto se abre lazy: al abrir el panel por primera vez (o tras cerrarlo) se llama `iniciarSesionAgenteTexto`; mostrar "Conectando…" hasta que el data channel abra. Cerrar el panel llama `cerrar()` de la sesión.
3. Manejo de errores: si falla la conexión o llega `onError`, mostrar el mensaje como burbuja del sistema dentro del chat (no alert).
4. El historial del chat vive solo en memoria mientras el panel está abierto; al cerrar y reabrir empieza limpio (la sesión Realtime también es nueva). Esto es aceptable y esperado.

### 4c. Estilos (agregar a `frontend/css/agent.css`)

Clases nuevas: `.agent-fab-root`, `.agent-fab`, `.agent-menu`, `.agent-menu-btn`, `.agent-panel` (base compartida de card flotante), `.agent-panel-voz`, `.agent-chat`, `.agent-chat-mensajes`, `.agent-chat-burbuja.usuario/.agente`, `.agent-chat-form`. Usar los tokens existentes (`var(--color-gold-deep)`, `var(--color-gold-tint)`, `var(--color-gold-border)`, `var(--radius)`, `var(--font-body)`) para que combine con el tema.

## Fase 5 — Cierre

1. `frontend/service-worker.js`: `CACHE_NAME` → `'anfitriones-v65'`. No hay archivos nuevos, `APP_SHELL` no cambia.
2. Validar sintaxis: `node --check frontend/js/agentPanel.js && node --check frontend/js/agentClient.js`.
3. `grep -rn "agent-column" frontend/` debe regresar vacío.
4. Commit + push a `main`, luego deploy:
   ```bash
   ssh -i ~/.ssh/id_ed25519_pwa_templo bAdmin@46.202.88.39 'cd ~/hospedaje && git pull && pm2 restart hospedaje-api'
   ```
   (backend no cambió, pero el restart no estorba; el pull es lo que publica el frontend).

## Checklist de verificación (en producción, tras hard-reload)

- [ ] Dashboard/Hogares/Mapa/etc.: el contenido llega hasta el borde derecho (menos el padding), sin columna vacía a la derecha.
- [ ] FAB visible abajo a la derecha en las 8 páginas y sobrevive la navegación SPA (navegar entre secciones no lo duplica ni lo pierde).
- [ ] FAB → menú → **Voz**: abre panel con orbe, conecta, escucha y responde por voz como antes; pedirle "llévame al mapa" navega vía SPA; "muéstrame la casa X" abre el modal por encima del panel.
- [ ] FAB → menú → **Texto**: se puede escribir, responde por texto en streaming, y las tools funcionan igual (probar: "cuántas casas hay", "muéstrame la lista de casas de la colonia X" → abre modal con tabla, "llévame a usuarios" → navega).
- [ ] Abrir Voz con Texto abierto (y viceversa) cierra el otro panel y su sesión (el micrófono se libera: el indicador de mic del navegador se apaga).
- [ ] Con el agente deshabilitado desde la página Agente, el FAB no aparece.
- [ ] En móvil (<860px) el FAB aparece y los paneles no desbordan la pantalla.
- [ ] Un usuario supervisor ve el FAB y el agente solo le ofrece las páginas permitidas (esto ya lo maneja el backend con `buildTools(role)` — solo confirmar que no se rompió).

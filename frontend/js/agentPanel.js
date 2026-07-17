import { iniciarSesionAgente, iniciarSesionAgenteTexto } from './agentClient.js';
import { obtenerConfigAgente, obtenerHogar } from './services/api.js';
import { getSession } from './services/session.js';
import { getActiveEventId } from './services/eventoActivo.js';
import { folioDe, renderDetalleHogarHTML, renderHogaresTablaHTML } from './hogarDetalleView.js';

const PUNTOS_ESFERA = 160;
const RADIO_BASE = 70;
const DISPERSION_MAX = 18;

let fabRoot, fab, menu;
let panelVoz, canvas, ctx, statusEl, wrap;
let panelTexto, chatMensajesEl, chatFormEl, chatInputEl, chatSendBtn;
let modalBackdrop, modalTitle, modalBody;
let puntosEsfera = [];
let rotacion = 0;
let nivelSuavizado = 0;
let nivelEntrada = 0;
let nivelSalida = 0;
let rafId = null;
let sesionVozActiva = null;
let sesionTextoActiva = null;
let burbujaAgenteActual = null;
let ultimoStatus = '';
let huboSalida = false;
let estado = 'dormido';
let panelAbierto = null;
let onNavegarPaginaCb = null;

function fibonacciEsfera(n, radio) {
  const puntos = [];
  const offset = 2 / n;
  const incremento = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * incremento;
    puntos.push({
      x: Math.cos(phi) * r * radio,
      y: y * radio,
      z: Math.sin(phi) * r * radio,
      jx: (Math.random() - 0.5) * 2,
      jy: (Math.random() - 0.5) * 2,
      jz: (Math.random() - 0.5) * 2,
    });
  }
  return puntos;
}

function crearModalVistaPrevia() {
  modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'admin-modal-backdrop stacked';
  modalBackdrop.hidden = true;
  modalBackdrop.innerHTML = `
    <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="agente-vista-previa-title">
      <div class="admin-modal-header">
        <h2 class="admin-modal-title" id="agente-vista-previa-title"></h2>
        <button type="button" class="admin-modal-close" aria-label="Cerrar">&times;</button>
      </div>
      <div class="admin-modal-body"></div>
    </div>
  `;
  document.body.appendChild(modalBackdrop);

  modalTitle = modalBackdrop.querySelector('#agente-vista-previa-title');
  modalBody = modalBackdrop.querySelector('.admin-modal-body');

  modalBackdrop.querySelector('.admin-modal-close').addEventListener('click', cerrarVistaPrevia);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) cerrarVistaPrevia();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.hidden) cerrarVistaPrevia();
  });
}

function mostrarVistaPreviaHogar(hogar) {
  modalTitle.textContent = `${hogar.nombre_dueno} · ${folioDe(hogar.id)}`;
  modalBody.innerHTML = renderDetalleHogarHTML(hogar);
  modalBackdrop.hidden = false;
}

async function abrirHogarPorId(id) {
  const session = getSession();
  if (!session) return;
  try {
    const { hogar } = await obtenerHogar(session.token, id);
    mostrarVistaPreviaHogar(hogar);
  } catch {
    modalBody.innerHTML = '<p class="admin-modal-empty">No se pudo cargar el detalle de este hogar.</p>';
  }
}

function mostrarListaHogares(titulo, hogares) {
  modalTitle.textContent = titulo;
  modalBody.innerHTML = renderHogaresTablaHTML(hogares);
  modalBody.querySelectorAll('tr[data-hogar-id]').forEach((row) => {
    row.addEventListener('click', () => abrirHogarPorId(Number(row.dataset.hogarId)));
  });
  modalBackdrop.hidden = false;
}

function cerrarVistaPrevia() {
  modalBackdrop.hidden = true;
}

function proyectar(p, escalaAudio, dispersion) {
  const px = p.x + p.jx * dispersion;
  const py = p.y + p.jy * dispersion;
  const pz = p.z + p.jz * dispersion;

  const cos = Math.cos(rotacion);
  const sin = Math.sin(rotacion);
  const x = px * cos - pz * sin;
  const z = px * sin + pz * cos;
  const factor = 1 + escalaAudio;
  const focal = 240;
  const escala = focal / (focal + z * factor);
  return {
    sx: canvas.width / 2 + x * factor * escala,
    sy: canvas.height / 2 + py * factor * escala,
    prof: z,
    escala,
  };
}

function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const nivelObjetivo = estado === 'activo' ? Math.max(nivelEntrada, nivelSalida) : 0;
  nivelSuavizado += (nivelObjetivo - nivelSuavizado) * 0.15;

  if (estado === 'activo') {
    if (nivelSalida > 0.08) huboSalida = true;
    const nuevoStatus = !huboSalida || (nivelSalida > 0.08 && nivelSalida >= nivelEntrada) ? 'Hablando…' : 'Escuchando…';
    if (nuevoStatus !== ultimoStatus) {
      ultimoStatus = nuevoStatus;
      statusEl.textContent = nuevoStatus;
    }
  }
  rotacion += 0.0025 + nivelSuavizado * 0.01;

  const escalaAudio = nivelSuavizado * 0.5;
  const dispersion = nivelSuavizado * DISPERSION_MAX;
  const proyectados = puntosEsfera
    .map((p) => proyectar(p, escalaAudio, dispersion))
    .sort((a, b) => a.prof - b.prof);

  proyectados.forEach(({ sx, sy, prof, escala }) => {
    const brillo = 0.4 + 0.5 * ((prof + RADIO_BASE) / (RADIO_BASE * 2)) + nivelSuavizado * 0.3;
    const tam = Math.max(1, 2.2 * escala);
    ctx.beginPath();
    ctx.fillStyle = `rgba(124, 94, 32, ${Math.min(1, brillo)})`;
    ctx.shadowColor = 'rgba(168, 131, 46, .6)';
    ctx.shadowBlur = 3 + nivelSuavizado * 10;
    ctx.arc(sx, sy, tam, 0, Math.PI * 2);
    ctx.fill();
  });

  rafId = requestAnimationFrame(dibujar);
}

async function despertar() {
  if (estado !== 'dormido') return;
  estado = 'conectando';
  statusEl.textContent = 'Despertando…';

  const session = getSession();
  const eventoId = getActiveEventId();
  if (!session || !eventoId) {
    estado = 'dormido';
    statusEl.textContent = 'Selecciona un evento primero';
    return;
  }

  try {
    const sesion = await iniciarSesionAgente({
      token: session.token,
      eventoId,
      onNivelEntrada: (n) => { nivelEntrada = n; },
      onNivelSalida: (n) => { nivelSalida = n; },
      onError: (msg) => { statusEl.textContent = msg; },
      onMostrarVistaPrevia: (hogar) => mostrarVistaPreviaHogar(hogar),
      onMostrarListaHogares: (titulo, hogares) => mostrarListaHogares(titulo, hogares),
      onNavegarPagina: (url) => {
        if (onNavegarPaginaCb) onNavegarPaginaCb(url);
        else window.location.href = url;
      },
    });

    if (estado !== 'conectando') {
      sesion.cerrar();
      return;
    }

    sesionVozActiva = sesion;
    estado = 'activo';
    huboSalida = false;
    ultimoStatus = 'Hablando…';
    statusEl.textContent = ultimoStatus;
  } catch (err) {
    estado = 'dormido';
    statusEl.textContent = 'No se pudo conectar con el agente';
  }
}

function dormir() {
  estado = 'dormido';
  sesionVozActiva?.cerrar();
  sesionVozActiva = null;
  nivelEntrada = 0;
  nivelSalida = 0;
  if (statusEl) statusEl.textContent = 'Toca para hablar';
}

function crearPanelVoz() {
  panelVoz = document.createElement('div');
  panelVoz.className = 'agent-voz-float';
  panelVoz.hidden = true;
  panelVoz.innerHTML = `
    <div class="agent-orb-wrap" role="button" tabindex="0" aria-label="Hablar con el agente">
      <div class="agent-orb-inner">
        <div class="agent-orb-glow"></div>
        <canvas class="agent-canvas" width="360" height="360"></canvas>
      </div>
      <p class="agent-status">Toca para hablar</p>
    </div>
  `;
  fabRoot.insertBefore(panelVoz, fab);

  wrap = panelVoz.querySelector('.agent-orb-wrap');
  canvas = panelVoz.querySelector('canvas');
  ctx = canvas.getContext('2d');
  statusEl = panelVoz.querySelector('.agent-status');

  const alternar = () => {
    if (estado === 'dormido') despertar();
    else dormir();
  };
  wrap.addEventListener('click', alternar);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
  });

  if (!rafId) rafId = requestAnimationFrame(dibujar);
}

function agregarBurbujaChat(texto, tipo) {
  const burbuja = document.createElement('div');
  burbuja.className = `agent-chat-burbuja ${tipo}`;
  burbuja.textContent = texto;
  chatMensajesEl.appendChild(burbuja);
  chatMensajesEl.scrollTop = chatMensajesEl.scrollHeight;
  return burbuja;
}

function fijarChatHabilitado(habilitado) {
  chatInputEl.disabled = !habilitado;
  chatSendBtn.disabled = !habilitado;
}

async function asegurarSesionTexto() {
  if (sesionTextoActiva) return sesionTextoActiva;

  const session = getSession();
  const eventoId = getActiveEventId();
  if (!session || !eventoId) {
    agregarBurbujaChat('Selecciona un evento primero.', 'sistema');
    return null;
  }

  fijarChatHabilitado(false);
  agregarBurbujaChat('Conectando…', 'sistema');

  try {
    sesionTextoActiva = await iniciarSesionAgenteTexto({
      token: session.token,
      eventoId,
      onTexto: (delta) => {
        if (!burbujaAgenteActual) burbujaAgenteActual = agregarBurbujaChat('', 'agente');
        burbujaAgenteActual.textContent += delta;
        chatMensajesEl.scrollTop = chatMensajesEl.scrollHeight;
      },
      onRespuestaTerminada: () => {
        burbujaAgenteActual = null;
        fijarChatHabilitado(true);
        chatInputEl.focus();
      },
      onError: (msg) => {
        agregarBurbujaChat(msg, 'sistema');
        fijarChatHabilitado(true);
      },
      onMostrarVistaPrevia: (hogar) => mostrarVistaPreviaHogar(hogar),
      onMostrarListaHogares: (titulo, hogares) => mostrarListaHogares(titulo, hogares),
      onNavegarPagina: (url) => {
        if (onNavegarPaginaCb) onNavegarPaginaCb(url);
        else window.location.href = url;
      },
    });
    fijarChatHabilitado(true);
    return sesionTextoActiva;
  } catch (err) {
    agregarBurbujaChat('No se pudo conectar con el agente.', 'sistema');
    fijarChatHabilitado(true);
    return null;
  }
}

function cerrarSesionTexto() {
  sesionTextoActiva?.cerrar();
  sesionTextoActiva = null;
  burbujaAgenteActual = null;
  if (chatMensajesEl) chatMensajesEl.innerHTML = '';
}

async function enviarMensajeTexto(texto) {
  agregarBurbujaChat(texto, 'usuario');
  const sesion = await asegurarSesionTexto();
  if (!sesion) return;
  fijarChatHabilitado(false);
  try {
    await sesion.enviarTexto(texto);
  } catch {
    agregarBurbujaChat('No se pudo enviar el mensaje.', 'sistema');
    fijarChatHabilitado(true);
  }
}

function crearPanelTexto() {
  panelTexto = document.createElement('div');
  panelTexto.className = 'agent-panel agent-chat';
  panelTexto.hidden = true;
  panelTexto.innerHTML = `
    <div class="agent-panel-header">
      <span>Asistente</span>
      <button type="button" class="agent-panel-close" aria-label="Cerrar"><span class="material-symbols-outlined">close</span></button>
    </div>
    <div class="agent-chat-mensajes"></div>
    <form class="agent-chat-form">
      <input type="text" class="agent-chat-input" placeholder="Escribe tu mensaje…" autocomplete="off" />
      <button type="submit" class="agent-chat-send">Enviar</button>
    </form>
  `;
  fabRoot.insertBefore(panelTexto, fab);

  chatMensajesEl = panelTexto.querySelector('.agent-chat-mensajes');
  chatFormEl = panelTexto.querySelector('.agent-chat-form');
  chatInputEl = panelTexto.querySelector('.agent-chat-input');
  chatSendBtn = panelTexto.querySelector('.agent-chat-send');

  panelTexto.querySelector('.agent-panel-close').addEventListener('click', cerrarPaneles);

  chatFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = chatInputEl.value.trim();
    if (!texto) return;
    chatInputEl.value = '';
    enviarMensajeTexto(texto);
  });
}

function cerrarPaneles() {
  if (panelVoz) {
    panelVoz.hidden = true;
    dormir();
  }
  if (panelTexto) {
    panelTexto.hidden = true;
    cerrarSesionTexto();
  }
  menu.hidden = true;
  panelAbierto = null;
}

function abrirPanel(modo) {
  menu.hidden = true;

  if (modo === panelAbierto) {
    cerrarPaneles();
    return;
  }

  if (panelAbierto === 'voz') dormir();
  if (panelAbierto === 'texto') cerrarSesionTexto();

  if (panelVoz) panelVoz.hidden = modo !== 'voz';
  if (panelTexto) panelTexto.hidden = modo !== 'texto';
  panelAbierto = modo;

  if (modo === 'texto') chatInputEl.focus();
}

function alternarMenu() {
  if (panelAbierto) {
    cerrarPaneles();
    return;
  }
  menu.hidden = !menu.hidden;
}

function crearDOM() {
  fabRoot = document.createElement('div');
  fabRoot.className = 'agent-fab-root';
  fabRoot.innerHTML = `
    <div class="agent-menu" hidden>
      <button type="button" class="agent-menu-btn" data-modo="texto"><span class="material-symbols-outlined">chat</span>Texto</button>
      <button type="button" class="agent-menu-btn" data-modo="voz"><span class="material-symbols-outlined">mic</span>Voz</button>
    </div>
    <button type="button" class="agent-fab" aria-label="Asistente"><span class="material-symbols-outlined">support_agent</span></button>
  `;
  document.body.appendChild(fabRoot);

  fab = fabRoot.querySelector('.agent-fab');
  menu = fabRoot.querySelector('.agent-menu');

  fab.addEventListener('click', alternarMenu);
  menu.querySelectorAll('.agent-menu-btn').forEach((btn) => {
    btn.addEventListener('click', () => abrirPanel(btn.dataset.modo));
  });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !fabRoot.contains(e.target)) {
      menu.hidden = true;
    }
  });

  crearPanelTexto();
  crearPanelVoz();
  crearModalVistaPrevia();
}

export async function setupAgentPanel({ onNavegarPagina } = {}) {
  onNavegarPaginaCb = onNavegarPagina || null;

  const session = getSession();
  if (!session) return;

  try {
    const { config } = await obtenerConfigAgente(session.token);
    if (!config.habilitado) return;
  } catch {
    return;
  }

  puntosEsfera = fibonacciEsfera(PUNTOS_ESFERA, RADIO_BASE);
  crearDOM();
}

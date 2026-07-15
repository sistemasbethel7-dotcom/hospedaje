import { iniciarSesionAgente } from './agentClient.js';
import { obtenerConfigAgente } from './services/api.js';
import { getSession } from './services/session.js';
import { getActiveEventId } from './services/eventoActivo.js';
import { folioDe, renderDetalleHogarHTML } from './hogarDetalleView.js';

const PUNTOS_ESFERA = 160;
const RADIO_BASE = 70;
const DISPERSION_MAX = 18;

let wrap, canvas, ctx, statusEl;
let modalBackdrop, modalTitle, modalBody;
let puntosEsfera = [];
let rotacion = 0;
let nivelSuavizado = 0;
let nivelEntrada = 0;
let nivelSalida = 0;
let rafId = null;
let sesionActiva = null;
let ultimoStatus = '';
let estado = 'dormido';
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

function crearDOM() {
  const contenedor = document.getElementById('agent-column');
  if (!contenedor) return;

  wrap = document.createElement('div');
  wrap.className = 'agent-orb-wrap';
  wrap.setAttribute('role', 'button');
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('aria-label', 'Hablar con el agente');
  wrap.innerHTML = `
    <div class="agent-orb-inner">
      <div class="agent-orb-glow"></div>
      <canvas class="agent-canvas" width="360" height="360"></canvas>
    </div>
    <p class="agent-status">Toca para hablar</p>
  `;

  contenedor.appendChild(wrap);

  canvas = wrap.querySelector('canvas');
  ctx = canvas.getContext('2d');
  statusEl = wrap.querySelector('.agent-status');

  const alternar = () => {
    if (estado === 'dormido') despertar();
    else dormir();
  };
  wrap.addEventListener('click', alternar);
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
  });

  crearModalVistaPrevia();
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
    const nuevoStatus = nivelSalida > 0.08 && nivelSalida >= nivelEntrada ? 'Hablando…' : 'Escuchando…';
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
      onNavegarPagina: (url) => {
        if (onNavegarPaginaCb) onNavegarPaginaCb(url);
        else window.location.href = url;
      },
    });

    if (estado !== 'conectando') {
      sesion.cerrar();
      return;
    }

    sesionActiva = sesion;
    estado = 'activo';
    ultimoStatus = 'Escuchando…';
    statusEl.textContent = ultimoStatus;
  } catch (err) {
    estado = 'dormido';
    statusEl.textContent = 'No se pudo conectar con el agente';
  }
}

function dormir() {
  estado = 'dormido';
  sesionActiva?.cerrar();
  sesionActiva = null;
  nivelEntrada = 0;
  nivelSalida = 0;
  statusEl.textContent = 'Toca para hablar';
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
  if (canvas) rafId = requestAnimationFrame(dibujar);
}

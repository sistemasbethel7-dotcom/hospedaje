const PUNTOS_ESFERA = 160;
const RADIO_BASE = 70;

let wrap, canvas, ctx, statusEl;
let puntosEsfera = [];
let rotacion = 0;
let nivelSuavizado = 0;
let nivelActual = 0;
let rafId = null;
let audioCtx = null;
let analyser = null;
let stream = null;
let estado = 'dormido';

function fibonacciEsfera(n, radio) {
  const puntos = [];
  const offset = 2 / n;
  const incremento = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * incremento;
    const jitter = 0.82 + Math.random() * 0.36;
    puntos.push({
      x: Math.cos(phi) * r * radio * jitter,
      y: y * radio * jitter,
      z: Math.sin(phi) * r * radio * jitter,
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
      <canvas class="agent-canvas" width="320" height="320"></canvas>
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
}

function proyectar(p, escalaAudio) {
  const cos = Math.cos(rotacion);
  const sin = Math.sin(rotacion);
  const x = p.x * cos - p.z * sin;
  const z = p.x * sin + p.z * cos;
  const factor = 1 + escalaAudio;
  const focal = 240;
  const escala = focal / (focal + z * factor);
  return {
    sx: canvas.width / 2 + x * factor * escala,
    sy: canvas.height / 2 + p.y * factor * escala,
    prof: z,
    escala,
  };
}

function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const nivelObjetivo = estado === 'escuchando' ? nivelActual : 0;
  nivelSuavizado += (nivelObjetivo - nivelSuavizado) * 0.15;
  rotacion += 0.0025 + nivelSuavizado * 0.01;

  const escalaAudio = nivelSuavizado * 0.5;
  const proyectados = puntosEsfera
    .map((p) => proyectar(p, escalaAudio))
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

async function iniciarMicrofono() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const fuente = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    fuente.connect(analyser);
    const datos = new Uint8Array(analyser.frequencyBinCount);

    const medir = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(datos);
      const prom = datos.reduce((a, b) => a + b, 0) / datos.length;
      nivelActual = Math.min(1, prom / 90);
      requestAnimationFrame(medir);
    };
    medir();

    estado = 'escuchando';
    statusEl.textContent = 'Escuchando… habla algo';
  } catch (err) {
    estado = 'dormido';
    statusEl.textContent = 'No se pudo acceder al micrófono';
  }
}

function detenerMicrofono() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (audioCtx) audioCtx.close();
  stream = null;
  audioCtx = null;
  analyser = null;
  nivelActual = 0;
}

function despertar() {
  if (estado !== 'dormido') return;
  estado = 'despertando';
  statusEl.textContent = 'Despertando…';
  iniciarMicrofono();
}

function dormir() {
  estado = 'dormido';
  detenerMicrofono();
  statusEl.textContent = 'Toca para hablar';
}

export function setupAgentPanel() {
  puntosEsfera = fibonacciEsfera(PUNTOS_ESFERA, RADIO_BASE);
  crearDOM();
  if (canvas) rafId = requestAnimationFrame(dibujar);
}

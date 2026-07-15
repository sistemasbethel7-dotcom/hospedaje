import { obtenerTokenAgente, listarHogares, obtenerMetricasEvento, obtenerHogar } from './services/api.js';
import { folioDe } from './hogarDetalleView.js';

const PAGINAS = {
  dashboard: 'dashboard.html',
  hogares: 'hogares.html',
  mapa: 'mapa.html',
  eventos: 'eventos.html',
  evento_nuevo: 'evento-nuevo.html',
  catalogos: 'catalogos.html',
  usuarios: 'usuarios.html',
  agente: 'agente.html',
};

function normaliza(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function calleBase(calleNumero) {
  const texto = String(calleNumero || '').trim();
  return texto.replace(/\s*#?\d+[\w-]*\s*$/, '').trim() || texto;
}

function filtrarHogares(hogares, args) {
  let resultados = hogares;

  if (args.dueno) resultados = resultados.filter((h) => normaliza(h.nombre_dueno).includes(normaliza(args.dueno)));
  if (args.calle) resultados = resultados.filter((h) => normaliza(h.calle_numero).includes(normaliza(args.calle)));
  if (args.colonia) resultados = resultados.filter((h) => normaliza(h.colonia).includes(normaliza(args.colonia)));
  if (args.solo_disponibles) resultados = resultados.filter((h) => h.capacidad - h.ocupacion_actual > 0);
  if (typeof args.capacidad_max === 'number') resultados = resultados.filter((h) => h.capacidad <= args.capacidad_max);
  if (typeof args.capacidad_min === 'number') resultados = resultados.filter((h) => h.capacidad >= args.capacidad_min);

  return resultados;
}

async function buscarHogares(ctx, args) {
  const { hogares } = await listarHogares(ctx.token, ctx.eventoId);
  const resultados = filtrarHogares(hogares, args);

  return {
    total_encontrados: resultados.length,
    hogares: resultados.slice(0, 8).map((h) => ({
      id: h.id,
      folio: folioDe(h.id),
      dueno: h.nombre_dueno,
      direccion: `${h.calle_numero}, ${h.colonia}`,
      capacidad: h.capacidad,
      ocupacion_actual: h.ocupacion_actual,
      disponibles: Math.max(0, h.capacidad - h.ocupacion_actual),
    })),
  };
}

async function metricasEvento(ctx) {
  const { metricas } = await obtenerMetricasEvento(ctx.token, ctx.eventoId);
  return {
    hogares_registrados: metricas.total_hogares,
    capacidad_total: metricas.capacidad_total,
    ocupacion_actual: metricas.ocupacion_total,
    lugares_disponibles: Math.max(0, metricas.capacidad_total - metricas.ocupacion_total),
  };
}

async function disponibilidadPorCalle(ctx) {
  const { hogares } = await listarHogares(ctx.token, ctx.eventoId);
  const grupos = new Map();

  hogares.forEach((h) => {
    const base = calleBase(h.calle_numero);
    const clave = normaliza(base);
    const disponibles = Math.max(0, h.capacidad - h.ocupacion_actual);
    const grupo = grupos.get(clave) || { calle: base, hogares: 0, capacidad: 0, ocupacion: 0, disponibles: 0 };
    grupo.hogares += 1;
    grupo.capacidad += h.capacidad;
    grupo.ocupacion += h.ocupacion_actual;
    grupo.disponibles += disponibles;
    grupos.set(clave, grupo);
  });

  const ranking = Array.from(grupos.values())
    .sort((a, b) => b.disponibles - a.disponibles)
    .slice(0, 8);

  return { calles_distintas: grupos.size, ranking };
}

async function abrirHogar(ctx, args) {
  const { hogar } = await obtenerHogar(ctx.token, args.id);
  ctx.onMostrarVistaPrevia?.(hogar);
  return { ok: true };
}

async function navegarAPagina(ctx, args) {
  const url = PAGINAS[args.pagina];
  if (!url) return { error: 'Página desconocida.' };
  ctx.onNavegarPagina?.(url);
  return { ok: true };
}

async function mostrarListaHogares(ctx, args) {
  const { hogares } = await listarHogares(ctx.token, ctx.eventoId);
  const resultados = filtrarHogares(hogares, args);
  ctx.onMostrarListaHogares?.(args.titulo || 'Resultados', resultados);
  return { total_mostrados: resultados.length };
}

async function ejecutarHerramienta(nombre, args, ctx) {
  try {
    if (nombre === 'buscar_hogares') return await buscarHogares(ctx, args);
    if (nombre === 'metricas_evento') return await metricasEvento(ctx);
    if (nombre === 'disponibilidad_por_calle') return await disponibilidadPorCalle(ctx);
    if (nombre === 'abrir_hogar') return await abrirHogar(ctx, args);
    if (nombre === 'navegar_a_pagina') return await navegarAPagina(ctx, args);
    if (nombre === 'mostrar_lista_hogares') return await mostrarListaHogares(ctx, args);
    return { error: 'Herramienta desconocida.' };
  } catch (err) {
    return { error: 'No se pudo completar la consulta.' };
  }
}

function medirNivel(stream, onNivel) {
  const audioCtx = new AudioContext();
  const fuente = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  fuente.connect(analyser);
  const datos = new Uint8Array(analyser.frequencyBinCount);
  let activo = true;

  const medir = () => {
    if (!activo) return;
    analyser.getByteFrequencyData(datos);
    const prom = datos.reduce((a, b) => a + b, 0) / datos.length;
    onNivel(Math.min(1, prom / 90));
    requestAnimationFrame(medir);
  };
  medir();

  return () => {
    activo = false;
    audioCtx.close();
  };
}

export async function iniciarSesionAgente({ token, eventoId, onNivelEntrada, onNivelSalida, onError, onMostrarVistaPrevia, onNavegarPagina, onMostrarListaHogares }) {
  const { value: clientSecret } = await obtenerTokenAgente(token);

  const pc = new RTCPeerConnection();
  const audioEl = new Audio();
  audioEl.autoplay = true;

  let detenerMedicionSalida = () => {};
  let detenerMedicionEntrada = () => {};

  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];
    detenerMedicionSalida = medirNivel(e.streams[0], onNivelSalida);
  };

  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  micStream.getTracks().forEach((t) => pc.addTrack(t, micStream));
  detenerMedicionEntrada = medirNivel(micStream, onNivelEntrada);

  const ctxHerramientas = { token, eventoId, onMostrarVistaPrevia, onNavegarPagina, onMostrarListaHogares };

  const dc = pc.createDataChannel('oai-events');
  dc.addEventListener('message', async (e) => {
    let evento;
    try {
      evento = JSON.parse(e.data);
    } catch {
      return;
    }

    if (evento.type === 'error') {
      onError?.(evento.error?.message || 'Ocurrió un error con el agente.');
      return;
    }

    if (evento.type !== 'response.done') return;

    const llamadas = (evento.response?.output || []).filter((item) => item.type === 'function_call');
    for (const llamada of llamadas) {
      let args = {};
      try {
        args = JSON.parse(llamada.arguments || '{}');
      } catch {
        args = {};
      }
      const resultado = await ejecutarHerramienta(llamada.name, args, ctxHerramientas);
      dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: llamada.call_id,
          output: JSON.stringify(resultado),
        },
      }));
    }
    if (llamadas.length > 0) {
      dc.send(JSON.stringify({ type: 'response.create' }));
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const respuesta = await fetch('https://api.openai.com/v1/realtime/calls?model=gpt-realtime-mini', {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });

  if (!respuesta.ok) {
    throw new Error('No se pudo conectar con el agente de voz.');
  }

  const answerSdp = await respuesta.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

  return {
    cerrar() {
      detenerMedicionEntrada();
      detenerMedicionSalida();
      micStream.getTracks().forEach((t) => t.stop());
      dc.close();
      pc.close();
    },
  };
}

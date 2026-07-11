import { insertEvento, listEventos, getEventoById, getEventoMetricas, updateEvento } from '../services/eventosService.js';
import { eventBus } from '../services/eventBus.js';

const ESTATUS_VALIDOS = ['abierto', 'finalizado'];

export async function crear(req, res) {
  const { nombre, sede, fecha_inicio, fecha_fin } = req.body;

  if (!nombre || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ message: 'Faltan datos obligatorios del evento.' });
  }
  if (fecha_fin < fecha_inicio) {
    return res.status(400).json({ message: 'La fecha de fin no puede ser anterior a la de inicio.' });
  }

  const evento = await insertEvento({
    nombre,
    sede: sede || null,
    fechaInicio: fecha_inicio,
    fechaFin: fecha_fin,
    creadoPor: req.user.sub,
  });

  res.status(201).json({ evento });
}

export async function listar(req, res) {
  const { estatus } = req.query;
  if (estatus && !ESTATUS_VALIDOS.includes(estatus)) {
    return res.status(400).json({ message: 'Estatus inválido.' });
  }
  const eventos = await listEventos(estatus);
  res.json({ eventos });
}

export async function detalle(req, res) {
  const evento = await getEventoById(req.params.id);
  if (!evento) {
    return res.status(404).json({ message: 'Evento no encontrado.' });
  }
  res.json({ evento });
}

export async function metricas(req, res) {
  const metricas = await getEventoMetricas(req.params.id);
  if (!metricas) {
    return res.status(404).json({ message: 'Evento no encontrado.' });
  }
  res.json({ metricas });
}

export function stream(req, res) {
  const eventoId = Number(req.params.id);
  const canal = `evento:${eventoId}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const enviarActualizacion = () => res.write('event: actualizado\ndata: {}\n\n');
  eventBus.on(canal, enviarActualizacion);

  const keepAlive = setInterval(() => res.write(':ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    eventBus.off(canal, enviarActualizacion);
  });
}

export async function actualizar(req, res) {
  const { nombre, sede, fecha_inicio, fecha_fin, estatus } = req.body;

  if (estatus && !ESTATUS_VALIDOS.includes(estatus)) {
    return res.status(400).json({ message: 'Estatus inválido.' });
  }

  const evento = await updateEvento(req.params.id, {
    nombre: nombre || null,
    sede: sede || null,
    fechaInicio: fecha_inicio || null,
    fechaFin: fecha_fin || null,
    estatus: estatus || null,
  });

  if (!evento) {
    return res.status(404).json({ message: 'Evento no encontrado.' });
  }

  res.json({ evento });
}

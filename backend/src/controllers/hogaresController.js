import {
  insertHogar,
  listHogares,
  getHogarDetalle,
  getHogarEventoId,
  updateHogar,
  deleteHogar,
  findPosiblesDuplicados,
} from '../services/hogaresService.js';
import { getEventoById } from '../services/eventosService.js';
import { usuarioTieneAccesoEvento } from '../services/usuariosService.js';
import { eventBus } from '../services/eventBus.js';

const TENENCIAS = ['Propia', 'Rentada'];

// Un agente solo puede modificar hogares de un evento que tenga asignado y que siga abierto.
// Admin no pasa por aquí (sin restricción, para poder corregir datos tras cerrar un evento).
async function bloqueoAgenteSobreHogar(req, hogarId) {
  if (req.user.role !== 'agente') return null;

  const eventoId = await getHogarEventoId(hogarId);
  if (!eventoId) {
    return { status: 404, message: 'Hogar no encontrado.' };
  }
  if (!(await usuarioTieneAccesoEvento(req.user.sub, req.user.role, eventoId))) {
    return { status: 403, message: 'No tienes acceso a este evento.' };
  }
  const evento = await getEventoById(eventoId);
  if (evento?.estatus === 'finalizado') {
    return { status: 409, message: 'El evento ya fue finalizado.' };
  }
  return null;
}

export async function crear(req, res) {
  const {
    evento_id,
    nombre_dueno,
    telefono_dueno,
    calle_numero,
    colonia,
    codigo_postal,
    estado,
    referencias,
    lat,
    lng,
    capacidad,
    tenencia,
    comentarios,
    folio_anterior,
    servicios,
    vulnerabilidades,
    notas_vulnerabilidad,
    perfil_sugerido,
    forzar_duplicado,
  } = req.body;

  const eventoId = Number(evento_id);
  if (!eventoId) {
    return res.status(400).json({ message: 'Falta el evento.' });
  }
  if (!nombre_dueno || !calle_numero || !colonia || !estado || !capacidad) {
    return res.status(400).json({ message: 'Faltan datos obligatorios de la casa.' });
  }
  if (tenencia && !TENENCIAS.includes(tenencia)) {
    return res.status(400).json({ message: 'La tenencia debe ser Propia o Rentada.' });
  }

  const evento = await getEventoById(eventoId);
  if (!evento) {
    return res.status(404).json({ message: 'Evento no encontrado.' });
  }
  if (req.user.role === 'agente' && !(await usuarioTieneAccesoEvento(req.user.sub, req.user.role, eventoId))) {
    return res.status(403).json({ message: 'No tienes acceso a este evento.' });
  }
  if (evento.estatus === 'finalizado') {
    return res.status(409).json({ message: 'El evento ya fue finalizado.' });
  }

  if (forzar_duplicado !== 'true') {
    const duplicados = await findPosiblesDuplicados({
      eventoId,
      telefonoDueno: telefono_dueno,
      calleNumero: calle_numero,
      colonia,
    });
    if (duplicados.length > 0) {
      return res.status(409).json({
        message: 'Ya existe un hogar registrado con el mismo teléfono o la misma dirección.',
        codigo: 'POSIBLE_DUPLICADO',
        duplicados,
      });
    }
  }

  const fotoDueno = req.files?.foto_dueno?.[0]?.filename || null;
  const fotoFachada = req.files?.foto_fachada?.[0]?.filename || null;

  const hogar = await insertHogar({
    eventoId,
    nombreDueno: nombre_dueno,
    telefonoDueno: telefono_dueno || null,
    calleNumero: calle_numero,
    colonia,
    codigoPostal: codigo_postal || null,
    estado,
    referencias: referencias || null,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    capacidad: Number(capacidad),
    tenencia: tenencia || null,
    comentarios: comentarios || null,
    folioAnterior: folio_anterior || null,
    fotoDueno,
    fotoFachada,
    servicios: servicios ? JSON.parse(servicios) : [],
    vulnerabilidades: vulnerabilidades ? JSON.parse(vulnerabilidades) : [],
    notasVulnerabilidad: notas_vulnerabilidad || null,
    perfilSugerido: perfil_sugerido ? JSON.parse(perfil_sugerido) : [],
    registradoPor: req.user.sub,
  });

  eventBus.emit(`evento:${eventoId}`);
  res.status(201).json({ hogar });
}

export async function listar(req, res) {
  const eventoId = Number(req.query.evento_id);
  if (!eventoId) {
    return res.status(400).json({ message: 'Falta el evento.' });
  }
  if (req.user.role === 'agente' && !(await usuarioTieneAccesoEvento(req.user.sub, req.user.role, eventoId))) {
    return res.status(403).json({ message: 'No tienes acceso a este evento.' });
  }
  const hogares = await listHogares(eventoId);
  res.json({ hogares });
}

export async function detalle(req, res) {
  const hogar = await getHogarDetalle(req.params.id);
  if (!hogar) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }
  if (req.user.role === 'agente' && !(await usuarioTieneAccesoEvento(req.user.sub, req.user.role, hogar.evento_id))) {
    return res.status(403).json({ message: 'No tienes acceso a este evento.' });
  }
  res.json({ hogar });
}

export async function actualizar(req, res) {
  const {
    nombre_dueno,
    telefono_dueno,
    calle_numero,
    colonia,
    codigo_postal,
    estado,
    referencias,
    lat,
    lng,
    capacidad,
    tenencia,
    comentarios,
    folio_anterior,
    servicios,
    vulnerabilidades,
    notas_vulnerabilidad,
    perfil_sugerido,
  } = req.body;

  if (!nombre_dueno || !calle_numero || !colonia || !estado || !capacidad) {
    return res.status(400).json({ message: 'Faltan datos obligatorios de la casa.' });
  }
  if (tenencia && !TENENCIAS.includes(tenencia)) {
    return res.status(400).json({ message: 'La tenencia debe ser Propia o Rentada.' });
  }

  const bloqueo = await bloqueoAgenteSobreHogar(req, req.params.id);
  if (bloqueo) {
    return res.status(bloqueo.status).json({ message: bloqueo.message });
  }

  const fotoDueno = req.files?.foto_dueno?.[0]?.filename || null;
  const fotoFachada = req.files?.foto_fachada?.[0]?.filename || null;

  const hogar = await updateHogar(req.params.id, {
    nombreDueno: nombre_dueno,
    telefonoDueno: telefono_dueno || null,
    calleNumero: calle_numero,
    colonia,
    codigoPostal: codigo_postal || null,
    estado,
    referencias: referencias || null,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    capacidad: Number(capacidad),
    tenencia: tenencia || null,
    comentarios: comentarios || null,
    folioAnterior: folio_anterior || null,
    fotoDueno,
    fotoFachada,
    servicios: servicios ? JSON.parse(servicios) : [],
    vulnerabilidades: vulnerabilidades ? JSON.parse(vulnerabilidades) : [],
    notasVulnerabilidad: notas_vulnerabilidad || null,
    perfilSugerido: perfil_sugerido ? JSON.parse(perfil_sugerido) : [],
  });

  if (!hogar) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }

  eventBus.emit(`evento:${hogar.evento_id}`);
  res.json({ hogar });
}

export async function eliminar(req, res) {
  const bloqueo = await bloqueoAgenteSobreHogar(req, req.params.id);
  if (bloqueo) {
    return res.status(bloqueo.status).json({ message: bloqueo.message });
  }

  const resultado = await deleteHogar(req.params.id);
  if (!resultado) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }
  eventBus.emit(`evento:${resultado.eventoId}`);
  res.status(204).end();
}

import {
  insertHogar,
  listHogares,
  getHogarDetalle,
  updateHogar,
  deleteHogar,
} from '../services/hogaresService.js';
import { getEventoById } from '../services/eventosService.js';

export async function crear(req, res) {
  const {
    evento_id,
    nombre_dueno,
    calle_numero,
    colonia,
    codigo_postal,
    referencias,
    lat,
    lng,
    capacidad,
    agua,
    luz,
    electricidad,
    vulnerabilidades,
    notas_vulnerabilidad,
    perfil_sugerido,
  } = req.body;

  const eventoId = Number(evento_id);
  if (!eventoId) {
    return res.status(400).json({ message: 'Falta el evento.' });
  }
  if (!nombre_dueno || !calle_numero || !colonia || !capacidad) {
    return res.status(400).json({ message: 'Faltan datos obligatorios de la casa.' });
  }

  const evento = await getEventoById(eventoId);
  if (!evento) {
    return res.status(404).json({ message: 'Evento no encontrado.' });
  }
  if (evento.estatus === 'finalizado') {
    return res.status(409).json({ message: 'El evento ya fue finalizado.' });
  }

  const fotoDueno = req.files?.foto_dueno?.[0]?.filename || null;
  const fotoFachada = req.files?.foto_fachada?.[0]?.filename || null;

  const hogar = await insertHogar({
    eventoId,
    nombreDueno: nombre_dueno,
    calleNumero: calle_numero,
    colonia,
    codigoPostal: codigo_postal || null,
    referencias: referencias || null,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    capacidad: Number(capacidad),
    fotoDueno,
    fotoFachada,
    agua: agua || null,
    luz: luz === 'true',
    electricidad: electricidad === 'true',
    vulnerabilidades: vulnerabilidades ? JSON.parse(vulnerabilidades) : [],
    notasVulnerabilidad: notas_vulnerabilidad || null,
    perfilSugerido: perfil_sugerido ? JSON.parse(perfil_sugerido) : [],
    registradoPor: req.user.sub,
  });

  res.status(201).json({ hogar });
}

export async function listar(req, res) {
  const eventoId = Number(req.query.evento_id);
  if (!eventoId) {
    return res.status(400).json({ message: 'Falta el evento.' });
  }
  const hogares = await listHogares(eventoId);
  res.json({ hogares });
}

export async function detalle(req, res) {
  const hogar = await getHogarDetalle(req.params.id);
  if (!hogar) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }
  res.json({ hogar });
}

export async function actualizar(req, res) {
  const {
    nombre_dueno,
    calle_numero,
    colonia,
    codigo_postal,
    referencias,
    lat,
    lng,
    capacidad,
    agua,
    luz,
    electricidad,
    vulnerabilidades,
    notas_vulnerabilidad,
    perfil_sugerido,
  } = req.body;

  if (!nombre_dueno || !calle_numero || !colonia || !capacidad) {
    return res.status(400).json({ message: 'Faltan datos obligatorios de la casa.' });
  }

  const fotoDueno = req.files?.foto_dueno?.[0]?.filename || null;
  const fotoFachada = req.files?.foto_fachada?.[0]?.filename || null;

  const hogar = await updateHogar(req.params.id, {
    nombreDueno: nombre_dueno,
    calleNumero: calle_numero,
    colonia,
    codigoPostal: codigo_postal || null,
    referencias: referencias || null,
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    capacidad: Number(capacidad),
    fotoDueno,
    fotoFachada,
    agua: agua || null,
    luz: luz === 'true',
    electricidad: electricidad === 'true',
    vulnerabilidades: vulnerabilidades ? JSON.parse(vulnerabilidades) : [],
    notasVulnerabilidad: notas_vulnerabilidad || null,
    perfilSugerido: perfil_sugerido ? JSON.parse(perfil_sugerido) : [],
  });

  if (!hogar) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }

  res.json({ hogar });
}

export async function eliminar(req, res) {
  const ok = await deleteHogar(req.params.id);
  if (!ok) {
    return res.status(404).json({ message: 'Hogar no encontrado.' });
  }
  res.status(204).end();
}

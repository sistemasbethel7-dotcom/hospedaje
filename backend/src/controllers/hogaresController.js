import { insertHogar } from '../services/hogaresService.js';

export async function crear(req, res) {
  const {
    nombre_dueno,
    direccion,
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

  if (!nombre_dueno || !direccion || !capacidad) {
    return res.status(400).json({ message: 'Faltan datos obligatorios de la casa.' });
  }

  const fotoDueno = req.files?.foto_dueno?.[0]?.filename || null;
  const fotoFachada = req.files?.foto_fachada?.[0]?.filename || null;

  const hogar = await insertHogar({
    nombreDueno: nombre_dueno,
    direccion,
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

import { pool } from '../config/db.js';

export class EventoFinalizadoError extends Error {}

const RESUMEN_SELECT = `
  SELECT e.id, e.nombre, e.sede, e.fecha_inicio, e.fecha_fin, e.estatus, e.created_at,
         COUNT(h.id)::int AS total_hogares,
         COALESCE(SUM(h.capacidad), 0)::int AS capacidad_total,
         COALESCE(SUM(h.ocupacion_actual), 0)::int AS ocupacion_total
  FROM eventos e
  LEFT JOIN hogares h ON h.evento_id = e.id
`;

export async function insertEvento(data) {
  const { rows } = await pool.query(
    `INSERT INTO eventos (nombre, sede, fecha_inicio, fecha_fin, creado_por)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, sede, fecha_inicio, fecha_fin, estatus, created_at`,
    [data.nombre, data.sede, data.fechaInicio, data.fechaFin, data.creadoPor]
  );
  return rows[0];
}

export async function listEventos(estatus) {
  const query = estatus
    ? `${RESUMEN_SELECT} WHERE e.estatus = $1 GROUP BY e.id ORDER BY e.created_at DESC`
    : `${RESUMEN_SELECT} GROUP BY e.id ORDER BY e.created_at DESC`;
  const { rows } = await pool.query(query, estatus ? [estatus] : []);
  return rows;
}

export async function getEventoById(id) {
  const { rows } = await pool.query(`${RESUMEN_SELECT} WHERE e.id = $1 GROUP BY e.id`, [id]);
  return rows[0] || null;
}

export async function getEventoMetricas(id) {
  const [resumen, colonias, vulnerabilidades, perfiles, servicios, agentes] = await Promise.all([
    getEventoById(id),
    pool.query(
      `SELECT colonia, COUNT(*)::int AS hogares,
              COALESCE(SUM(capacidad), 0)::int AS capacidad,
              COALESCE(SUM(ocupacion_actual), 0)::int AS ocupacion
       FROM hogares WHERE evento_id = $1
       GROUP BY colonia ORDER BY hogares DESC LIMIT 10`,
      [id]
    ),
    pool.query(
      `SELECT UNNEST(vulnerabilidades) AS etiqueta, COUNT(*)::int AS total
       FROM hogares WHERE evento_id = $1
       GROUP BY etiqueta ORDER BY total DESC`,
      [id]
    ),
    pool.query(
      `SELECT UNNEST(perfil_sugerido) AS etiqueta, COUNT(*)::int AS total
       FROM hogares WHERE evento_id = $1
       GROUP BY etiqueta ORDER BY total DESC`,
      [id]
    ),
    pool.query(
      `SELECT UNNEST(servicios) AS etiqueta, COUNT(*)::int AS total
       FROM hogares WHERE evento_id = $1
       GROUP BY etiqueta ORDER BY total DESC`,
      [id]
    ),
    pool.query(
      `SELECT h.registrado_por, COALESCE(u.nombre, u.email, 'Usuario eliminado') AS etiqueta, COUNT(*)::int AS total
       FROM hogares h
       LEFT JOIN usuarios u ON u.id = h.registrado_por
       WHERE h.evento_id = $1 AND (u.role IS NULL OR u.role <> 'admin')
       GROUP BY h.registrado_por, u.nombre, u.email
       ORDER BY total DESC`,
      [id]
    ),
  ]);

  if (!resumen) return null;

  return {
    ...resumen,
    colonias: colonias.rows,
    vulnerabilidades: vulnerabilidades.rows,
    perfiles: perfiles.rows,
    servicios: servicios.rows,
    agentes: agentes.rows,
  };
}

export async function updateEvento(id, data) {
  const { rows } = await pool.query(
    `UPDATE eventos SET
       nombre = COALESCE($1, nombre),
       sede = COALESCE($2, sede),
       fecha_inicio = COALESCE($3, fecha_inicio),
       fecha_fin = COALESCE($4, fecha_fin),
       estatus = COALESCE($5, estatus)
     WHERE id = $6
     RETURNING id, nombre, sede, fecha_inicio, fecha_fin, estatus, created_at`,
    [data.nombre, data.sede, data.fechaInicio, data.fechaFin, data.estatus, id]
  );
  return rows[0] || null;
}

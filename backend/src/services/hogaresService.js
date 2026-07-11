import { pool } from '../config/db.js';

export async function insertHogar(data) {
  const { rows } = await pool.query(
    `INSERT INTO hogares
      (nombre_dueno, direccion, lat, lng, capacidad, foto_dueno, foto_fachada,
       agua, luz, electricidad, vulnerabilidades, notas_vulnerabilidad, perfil_sugerido, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id, nombre_dueno, direccion, capacidad, created_at`,
    [
      data.nombreDueno,
      data.direccion,
      data.lat,
      data.lng,
      data.capacidad,
      data.fotoDueno,
      data.fotoFachada,
      data.agua,
      data.luz,
      data.electricidad,
      data.vulnerabilidades,
      data.notasVulnerabilidad,
      data.perfilSugerido,
      data.registradoPor,
    ]
  );
  return rows[0];
}

export async function listHogares() {
  const { rows } = await pool.query(
    `SELECT id, nombre_dueno, direccion, capacidad, ocupacion_actual, foto_fachada, created_at
     FROM hogares
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function getHogarById(id) {
  const { rows } = await pool.query(
    'SELECT id, nombre_dueno, capacidad, ocupacion_actual FROM hogares WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

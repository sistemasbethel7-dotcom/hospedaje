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

export async function getHogarDetalle(id) {
  const { rows } = await pool.query(
    `SELECT id, nombre_dueno, direccion, lat, lng, capacidad, ocupacion_actual,
            foto_dueno, foto_fachada, agua, luz, electricidad,
            vulnerabilidades, notas_vulnerabilidad, perfil_sugerido, created_at
     FROM hogares
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function updateHogar(id, data) {
  const { rows } = await pool.query(
    `UPDATE hogares SET
       nombre_dueno = $1,
       direccion = $2,
       lat = $3,
       lng = $4,
       capacidad = $5,
       agua = $6,
       luz = $7,
       electricidad = $8,
       vulnerabilidades = $9,
       notas_vulnerabilidad = $10,
       perfil_sugerido = $11,
       foto_dueno = COALESCE($12, foto_dueno),
       foto_fachada = COALESCE($13, foto_fachada)
     WHERE id = $14
     RETURNING id, nombre_dueno, direccion, capacidad, created_at`,
    [
      data.nombreDueno,
      data.direccion,
      data.lat,
      data.lng,
      data.capacidad,
      data.agua,
      data.luz,
      data.electricidad,
      data.vulnerabilidades,
      data.notasVulnerabilidad,
      data.perfilSugerido,
      data.fotoDueno,
      data.fotoFachada,
      id,
    ]
  );
  return rows[0] || null;
}

export async function deleteHogar(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ingresos WHERE hogar_id = $1', [id]);
    const { rowCount } = await client.query('DELETE FROM hogares WHERE id = $1', [id]);
    await client.query('COMMIT');
    return rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

import { pool } from '../config/db.js';

export async function insertHogar(data) {
  const { rows } = await pool.query(
    `INSERT INTO hogares
      (evento_id, nombre_dueno, calle_numero, colonia, codigo_postal, referencias, lat, lng, capacidad,
       foto_dueno, foto_fachada, servicios, vulnerabilidades, notas_vulnerabilidad,
       perfil_sugerido, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id, nombre_dueno, calle_numero, colonia, capacidad, created_at`,
    [
      data.eventoId,
      data.nombreDueno,
      data.calleNumero,
      data.colonia,
      data.codigoPostal,
      data.referencias,
      data.lat,
      data.lng,
      data.capacidad,
      data.fotoDueno,
      data.fotoFachada,
      data.servicios,
      data.vulnerabilidades,
      data.notasVulnerabilidad,
      data.perfilSugerido,
      data.registradoPor,
    ]
  );
  return rows[0];
}

export async function listHogares(eventoId) {
  const { rows } = await pool.query(
    `SELECT id, nombre_dueno, calle_numero, colonia, codigo_postal, capacidad, ocupacion_actual, foto_fachada, lat, lng, created_at
     FROM hogares
     WHERE evento_id = $1
     ORDER BY created_at DESC`,
    [eventoId]
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
    `SELECT id, evento_id, nombre_dueno, calle_numero, colonia, codigo_postal, referencias, lat, lng,
            capacidad, ocupacion_actual, foto_dueno, foto_fachada, servicios,
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
       calle_numero = $2,
       colonia = $3,
       codigo_postal = $4,
       referencias = $5,
       lat = $6,
       lng = $7,
       capacidad = $8,
       servicios = $9,
       vulnerabilidades = $10,
       notas_vulnerabilidad = $11,
       perfil_sugerido = $12,
       foto_dueno = COALESCE($13, foto_dueno),
       foto_fachada = COALESCE($14, foto_fachada)
     WHERE id = $15
     RETURNING id, evento_id, nombre_dueno, calle_numero, colonia, capacidad, created_at`,
    [
      data.nombreDueno,
      data.calleNumero,
      data.colonia,
      data.codigoPostal,
      data.referencias,
      data.lat,
      data.lng,
      data.capacidad,
      data.servicios,
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
    const { rows } = await client.query('SELECT evento_id FROM hogares WHERE id = $1', [id]);
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('DELETE FROM ingresos WHERE hogar_id = $1', [id]);
    await client.query('DELETE FROM hogares WHERE id = $1', [id]);
    await client.query('COMMIT');
    return { eventoId: rows[0].evento_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

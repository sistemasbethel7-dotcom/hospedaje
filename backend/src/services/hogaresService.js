import { pool } from '../config/db.js';

export async function insertHogar(data) {
  const { rows } = await pool.query(
    `INSERT INTO hogares
      (evento_id, nombre_dueno, telefono_dueno, calle_numero, colonia, codigo_postal, estado, referencias, lat, lng, capacidad,
       tenencia, comentarios, folio_anterior, foto_dueno, foto_fachada, servicios, vulnerabilidades, notas_vulnerabilidad,
       perfil_sugerido, registrado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING id, nombre_dueno, calle_numero, colonia, capacidad, created_at`,
    [
      data.eventoId,
      data.nombreDueno,
      data.telefonoDueno,
      data.calleNumero,
      data.colonia,
      data.codigoPostal,
      data.estado,
      data.referencias,
      data.lat,
      data.lng,
      data.capacidad,
      data.tenencia,
      data.comentarios,
      data.folioAnterior,
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
    `SELECT id, nombre_dueno, calle_numero, colonia, codigo_postal, estado, capacidad, ocupacion_actual, tenencia, folio_anterior, foto_fachada, lat, lng, created_at
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
    `SELECT id, evento_id, nombre_dueno, telefono_dueno, calle_numero, colonia, codigo_postal, estado, referencias, lat, lng,
            capacidad, ocupacion_actual, tenencia, comentarios, folio_anterior, foto_dueno, foto_fachada, servicios,
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
       telefono_dueno = $2,
       calle_numero = $3,
       colonia = $4,
       codigo_postal = $5,
       estado = $6,
       referencias = $7,
       lat = $8,
       lng = $9,
       capacidad = $10,
       tenencia = $11,
       comentarios = $12,
       servicios = $13,
       vulnerabilidades = $14,
       notas_vulnerabilidad = $15,
       perfil_sugerido = $16,
       foto_dueno = COALESCE($17, foto_dueno),
       foto_fachada = COALESCE($18, foto_fachada)
     WHERE id = $19
     RETURNING id, evento_id, nombre_dueno, calle_numero, colonia, capacidad, created_at`,
    [
      data.nombreDueno,
      data.telefonoDueno,
      data.calleNumero,
      data.colonia,
      data.codigoPostal,
      data.estado,
      data.referencias,
      data.lat,
      data.lng,
      data.capacidad,
      data.tenencia,
      data.comentarios,
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

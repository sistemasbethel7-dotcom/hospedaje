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

export async function findPosiblesDuplicados({ eventoId, telefonoDueno, calleNumero, colonia, excludeId }) {
  const telefonoNorm = telefonoDueno ? telefonoDueno.replace(/\D/g, '') : '';
  if (!telefonoNorm && !(calleNumero && colonia)) return [];

  const { rows } = await pool.query(
    `SELECT id, nombre_dueno, telefono_dueno, calle_numero, colonia, folio_anterior, created_at
     FROM hogares
     WHERE evento_id = $1
       AND id <> COALESCE($2, -1)
       AND (
         ($3 <> '' AND regexp_replace(COALESCE(telefono_dueno, ''), '\D', '', 'g') = $3)
         OR (lower(trim(calle_numero)) = lower(trim($4)) AND lower(trim(colonia)) = lower(trim($5)) AND $4 <> '' AND $5 <> '')
       )
     ORDER BY id`,
    [eventoId, excludeId || null, telefonoNorm, calleNumero || '', colonia || '']
  );
  return rows;
}

export async function listHogares(eventoId) {
  const { rows } = await pool.query(
    `SELECT id, nombre_dueno, calle_numero, colonia, codigo_postal, estado, capacidad, ocupacion_actual, tenencia, folio_anterior, comentarios, foto_fachada, lat, lng, posible_duplicado_de, created_at
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
    `SELECT h.id, h.evento_id, h.nombre_dueno, h.telefono_dueno, h.calle_numero, h.colonia, h.codigo_postal, h.estado, h.referencias, h.lat, h.lng,
            h.capacidad, h.ocupacion_actual, h.tenencia, h.comentarios, h.folio_anterior, h.foto_dueno, h.foto_fachada, h.servicios,
            h.vulnerabilidades, h.notas_vulnerabilidad, h.perfil_sugerido, h.created_at,
            u.nombre AS registrado_por_nombre, u.email AS registrado_por_email
     FROM hogares h
     LEFT JOIN usuarios u ON u.id = h.registrado_por
     WHERE h.id = $1`,
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

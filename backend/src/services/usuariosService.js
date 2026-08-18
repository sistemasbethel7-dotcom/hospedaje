import crypto from 'node:crypto';
import { pool } from '../config/db.js';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function listUsuarios() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.nombre, u.telefono, u.role, u.activo, u.created_at,
            (u.password_hash IS NULL) AS pendiente,
            COALESCE(
              (SELECT json_agg(json_build_object('id', e.id, 'nombre', e.nombre, 'sede', e.sede) ORDER BY e.created_at DESC)
               FROM usuario_eventos ue JOIN eventos e ON e.id = ue.evento_id
               WHERE ue.usuario_id = u.id),
              '[]'
            ) AS eventos
     FROM usuarios u ORDER BY u.created_at DESC`
  );
  return rows;
}

export async function setUsuarioEventos(usuarioId, eventosIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM usuario_eventos WHERE usuario_id = $1', [usuarioId]);
    if (eventosIds.length > 0) {
      const values = eventosIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO usuario_eventos (usuario_id, evento_id) VALUES ${values}`,
        [usuarioId, ...eventosIds]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function usuarioTieneAccesoEvento(usuarioId, role, eventoId) {
  if (role !== 'agente') return true;
  const { rows } = await pool.query(
    'SELECT 1 FROM usuario_eventos WHERE usuario_id = $1 AND evento_id = $2',
    [usuarioId, eventoId]
  );
  return rows.length > 0;
}

export async function insertUsuarioInvitado({ email, role, nombre, telefono, eventosIds }) {
  const token = crypto.randomBytes(32).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO usuarios (email, password_hash, role, nombre, telefono, setup_token_hash, setup_token_expires)
       VALUES ($1, NULL, $2, $3, $4, $5, $6)
       RETURNING id, email, nombre, telefono, role, activo, created_at`,
      [email, role, nombre || null, telefono || null, hashToken(token), new Date(Date.now() + TOKEN_TTL_MS)]
    );
    const usuario = rows[0];
    if (role === 'agente' && eventosIds?.length > 0) {
      const values = eventosIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO usuario_eventos (usuario_id, evento_id) VALUES ${values}`,
        [usuario.id, ...eventosIds]
      );
    }
    await client.query('COMMIT');
    return { usuario, token };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function regenerarTokenInvitacion(id) {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `UPDATE usuarios SET setup_token_hash = $1, setup_token_expires = $2
     WHERE id = $3 AND password_hash IS NULL
     RETURNING id, email`,
    [hashToken(token), new Date(Date.now() + TOKEN_TTL_MS), id]
  );
  if (!rows[0]) return null;
  return { usuario: rows[0], token };
}

export async function buscarPorTokenInvitacion(token) {
  const { rows } = await pool.query(
    `SELECT id, email FROM usuarios
     WHERE setup_token_hash = $1 AND setup_token_expires > now()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

export async function establecerPasswordDesdeToken(token, passwordHash) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET password_hash = $1, setup_token_hash = NULL, setup_token_expires = NULL
     WHERE setup_token_hash = $2 AND setup_token_expires > now()
     RETURNING id, email, role, activo`,
    [passwordHash, hashToken(token)]
  );
  return rows[0] || null;
}

export async function getUsuario(id) {
  const { rows } = await pool.query('SELECT id, role FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateUsuario(id, data) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET
       role = COALESCE($1, role),
       activo = COALESCE($2, activo),
       password_hash = COALESCE($3, password_hash),
       nombre = COALESCE($4, nombre),
       telefono = COALESCE($5, telefono)
     WHERE id = $6
     RETURNING id, email, nombre, telefono, role, activo, created_at`,
    [data.role, data.activo, data.passwordHash, data.nombre, data.telefono, id]
  );
  return rows[0] || null;
}

export async function deleteUsuario(id) {
  const { rowCount } = await pool.query(
    `DELETE FROM usuarios WHERE id = $1`,
    [id]
  );
  return rowCount > 0;
}

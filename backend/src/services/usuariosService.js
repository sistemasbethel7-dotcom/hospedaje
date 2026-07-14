import crypto from 'node:crypto';
import { pool } from '../config/db.js';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function listUsuarios() {
  const { rows } = await pool.query(
    `SELECT id, email, role, activo, created_at, (password_hash IS NULL) AS pendiente
     FROM usuarios ORDER BY created_at DESC`
  );
  return rows;
}

export async function insertUsuarioInvitado({ email, role }) {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, role, setup_token_hash, setup_token_expires)
     VALUES ($1, NULL, $2, $3, $4)
     RETURNING id, email, role, activo, created_at`,
    [email, role, hashToken(token), new Date(Date.now() + TOKEN_TTL_MS)]
  );
  return { usuario: rows[0], token };
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

export async function updateUsuario(id, data) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET
       role = COALESCE($1, role),
       activo = COALESCE($2, activo),
       password_hash = COALESCE($3, password_hash)
     WHERE id = $4
     RETURNING id, email, role, activo, created_at`,
    [data.role, data.activo, data.passwordHash, id]
  );
  return rows[0] || null;
}

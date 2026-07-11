import { pool } from '../config/db.js';

export async function listUsuarios() {
  const { rows } = await pool.query(
    'SELECT id, email, role, activo, created_at FROM usuarios ORDER BY created_at DESC'
  );
  return rows;
}

export async function insertUsuario(data) {
  const { rows } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role, activo, created_at`,
    [data.email, data.passwordHash, data.role]
  );
  return rows[0];
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

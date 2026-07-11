import { pool } from '../config/db.js';

export async function listCatalogo(tipo) {
  const { rows } = await pool.query(
    'SELECT id, tipo, etiqueta, orden, activo FROM catalogos WHERE tipo = $1 ORDER BY orden, id',
    [tipo]
  );
  return rows;
}

export async function listCatalogosActivos() {
  const { rows } = await pool.query(
    'SELECT tipo, etiqueta FROM catalogos WHERE activo = true ORDER BY tipo, orden, id'
  );
  const resultado = { servicio: [], vulnerabilidad: [], perfil: [] };
  rows.forEach((row) => resultado[row.tipo].push(row.etiqueta));
  return resultado;
}

export async function insertCatalogoItem(tipo, etiqueta) {
  const { rows } = await pool.query(
    `INSERT INTO catalogos (tipo, etiqueta, orden)
     VALUES ($1, $2, COALESCE((SELECT MAX(orden) + 1 FROM catalogos WHERE tipo = $1), 1))
     RETURNING id, tipo, etiqueta, orden, activo`,
    [tipo, etiqueta]
  );
  return rows[0];
}

export async function updateCatalogoItem(id, { etiqueta, activo }) {
  const { rows } = await pool.query(
    `UPDATE catalogos SET
       etiqueta = COALESCE($1, etiqueta),
       activo = COALESCE($2, activo)
     WHERE id = $3
     RETURNING id, tipo, etiqueta, orden, activo`,
    [etiqueta ?? null, activo ?? null, id]
  );
  return rows[0] || null;
}

export async function deleteCatalogoItem(id) {
  const { rowCount } = await pool.query('DELETE FROM catalogos WHERE id = $1', [id]);
  return rowCount > 0;
}

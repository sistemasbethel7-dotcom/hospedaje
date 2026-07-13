import { pool } from '../config/db.js';

export async function buscarPorCP(cp) {
  const { rows } = await pool.query(
    `SELECT DISTINCT colonia, tipo_asentamiento
     FROM codigos_postales
     WHERE cp = $1
     ORDER BY colonia`,
    [cp]
  );
  if (rows.length === 0) return null;

  const { rows: estadoRows } = await pool.query(
    'SELECT estado FROM codigos_postales WHERE cp = $1 LIMIT 1',
    [cp]
  );

  return {
    estado: estadoRows[0].estado,
    colonias: rows,
  };
}

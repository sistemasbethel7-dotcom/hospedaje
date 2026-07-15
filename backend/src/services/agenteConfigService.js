import { pool } from '../config/db.js';

export const VOCES_VALIDAS = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

export async function obtenerConfig() {
  const { rows } = await pool.query(
    'SELECT habilitado, voz, acento_estilo FROM agente_config WHERE id = 1'
  );
  return rows[0];
}

export async function actualizarConfig({ habilitado, voz, acento_estilo }) {
  const { rows } = await pool.query(
    `UPDATE agente_config SET
       habilitado = $1,
       voz = $2,
       acento_estilo = $3,
       actualizado_en = now()
     WHERE id = 1
     RETURNING habilitado, voz, acento_estilo`,
    [habilitado, voz, acento_estilo]
  );
  return rows[0];
}

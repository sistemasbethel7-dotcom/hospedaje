import { pool } from '../config/db.js';

export class CapacidadExcedidaError extends Error {}

export async function registrarIngreso(hogarId, cantidad, registradoPor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT capacidad, ocupacion_actual FROM hogares WHERE id = $1 FOR UPDATE',
      [hogarId]
    );
    const hogar = rows[0];
    if (!hogar) {
      throw new Error('Hogar no encontrado.');
    }

    const nuevaOcupacion = hogar.ocupacion_actual + cantidad;
    if (nuevaOcupacion > hogar.capacidad) {
      throw new CapacidadExcedidaError(
        `Solo quedan ${hogar.capacidad - hogar.ocupacion_actual} lugares disponibles.`
      );
    }

    await client.query(
      'INSERT INTO ingresos (hogar_id, cantidad, registrado_por) VALUES ($1, $2, $3)',
      [hogarId, cantidad, registradoPor]
    );

    const { rows: updated } = await client.query(
      'UPDATE hogares SET ocupacion_actual = $1 WHERE id = $2 RETURNING id, nombre_dueno, capacidad, ocupacion_actual',
      [nuevaOcupacion, hogarId]
    );

    await client.query('COMMIT');
    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

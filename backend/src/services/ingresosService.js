import { pool } from '../config/db.js';
import { EventoFinalizadoError } from './eventosService.js';

export class CapacidadExcedidaError extends Error {}

export async function registrarIngreso(hogarId, cantidad, registradoPor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT h.capacidad, h.ocupacion_actual, h.evento_id, e.estatus AS evento_estatus
       FROM hogares h JOIN eventos e ON e.id = h.evento_id
       WHERE h.id = $1
       FOR UPDATE OF h`,
      [hogarId]
    );
    const hogar = rows[0];
    if (!hogar) {
      throw new Error('Hogar no encontrado.');
    }
    if (hogar.evento_estatus === 'finalizado') {
      throw new EventoFinalizadoError('El evento ya fue finalizado.');
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
    return { ...updated[0], evento_id: hogar.evento_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

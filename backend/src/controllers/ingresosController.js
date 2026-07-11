import { registrarIngreso, CapacidadExcedidaError } from '../services/ingresosService.js';

export async function crear(req, res) {
  const { cantidad } = req.body;
  const hogarId = Number(req.params.id);
  const cantidadNum = Number(cantidad);

  if (!hogarId || !cantidadNum || cantidadNum < 1) {
    return res.status(400).json({ message: 'Cantidad inválida.' });
  }

  try {
    const hogar = await registrarIngreso(hogarId, cantidadNum, req.user.sub);
    res.status(201).json({ hogar });
  } catch (err) {
    if (err instanceof CapacidadExcedidaError) {
      return res.status(409).json({ message: err.message });
    }
    if (err.message === 'Hogar no encontrado.') {
      return res.status(404).json({ message: err.message });
    }
    throw err;
  }
}

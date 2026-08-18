import { registrarIngreso, CapacidadExcedidaError } from '../services/ingresosService.js';
import { EventoFinalizadoError } from '../services/eventosService.js';
import { getHogarEventoId } from '../services/hogaresService.js';
import { usuarioTieneAccesoEvento } from '../services/usuariosService.js';
import { eventBus } from '../services/eventBus.js';

export async function crear(req, res) {
  const { cantidad } = req.body;
  const hogarId = Number(req.params.id);
  const cantidadNum = Number(cantidad);

  if (!hogarId || !cantidadNum || cantidadNum < 1) {
    return res.status(400).json({ message: 'Cantidad inválida.' });
  }

  if (req.user.role === 'agente') {
    const eventoId = await getHogarEventoId(hogarId);
    if (!eventoId) {
      return res.status(404).json({ message: 'Hogar no encontrado.' });
    }
    if (!(await usuarioTieneAccesoEvento(req.user.sub, req.user.role, eventoId))) {
      return res.status(403).json({ message: 'No tienes acceso a este evento.' });
    }
  }

  try {
    const hogar = await registrarIngreso(hogarId, cantidadNum, req.user.sub);
    eventBus.emit(`evento:${hogar.evento_id}`);
    res.status(201).json({ hogar });
  } catch (err) {
    if (err instanceof CapacidadExcedidaError || err instanceof EventoFinalizadoError) {
      return res.status(409).json({ message: err.message });
    }
    if (err.message === 'Hogar no encontrado.') {
      return res.status(404).json({ message: err.message });
    }
    throw err;
  }
}

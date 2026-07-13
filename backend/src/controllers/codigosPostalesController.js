import { buscarPorCP } from '../services/codigosPostalesService.js';

export async function buscar(req, res) {
  const cp = req.params.cp;
  if (!/^\d{5}$/.test(cp)) {
    return res.status(400).json({ message: 'Código postal inválido.' });
  }

  const resultado = await buscarPorCP(cp);
  if (!resultado) {
    return res.status(404).json({ message: 'Código postal no encontrado.' });
  }
  res.json(resultado);
}

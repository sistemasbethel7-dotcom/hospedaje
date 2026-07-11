import {
  listCatalogo,
  listCatalogosActivos,
  insertCatalogoItem,
  updateCatalogoItem,
  deleteCatalogoItem,
} from '../services/catalogosService.js';

const TIPOS_VALIDOS = ['servicio', 'vulnerabilidad', 'perfil'];

export async function listar(req, res) {
  const { tipo } = req.query;
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ message: 'Tipo de catálogo inválido.' });
  }
  const items = await listCatalogo(tipo);
  res.json({ items });
}

export async function listarActivos(req, res) {
  const catalogos = await listCatalogosActivos();
  res.json({ catalogos });
}

export async function crear(req, res) {
  const { tipo, etiqueta } = req.body;
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ message: 'Tipo de catálogo inválido.' });
  }
  if (!etiqueta || !etiqueta.trim()) {
    return res.status(400).json({ message: 'La etiqueta es obligatoria.' });
  }
  const item = await insertCatalogoItem(tipo, etiqueta.trim());
  res.status(201).json({ item });
}

export async function actualizar(req, res) {
  const { etiqueta, activo } = req.body;
  const item = await updateCatalogoItem(req.params.id, {
    etiqueta: typeof etiqueta === 'string' ? etiqueta.trim() : null,
    activo: typeof activo === 'boolean' ? activo : null,
  });
  if (!item) {
    return res.status(404).json({ message: 'Elemento no encontrado.' });
  }
  res.json({ item });
}

export async function eliminar(req, res) {
  const ok = await deleteCatalogoItem(req.params.id);
  if (!ok) {
    return res.status(404).json({ message: 'Elemento no encontrado.' });
  }
  res.status(204).end();
}

export function subscribeToEvento(token, eventoId, { onUpdate, onStatusChange } = {}) {
  const source = new EventSource(`/api/eventos/${eventoId}/stream?token=${encodeURIComponent(token)}`);

  source.addEventListener('actualizado', () => onUpdate?.());
  source.addEventListener('open', () => onStatusChange?.('live'));
  source.addEventListener('error', () => onStatusChange?.('reconectando'));

  return () => source.close();
}

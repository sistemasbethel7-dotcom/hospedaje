const STORAGE_KEY = 'anfitriones_evento_activo';

export function setActiveEventId(id) {
  localStorage.setItem(STORAGE_KEY, String(id));
}

export function getActiveEventId() {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearActiveEventId() {
  localStorage.removeItem(STORAGE_KEY);
}

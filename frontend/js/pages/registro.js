import { registerServiceWorker } from '../app.js';
import { crearHogar } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

const TOTAL_STEPS = 6;
const DRAFT_KEY = 'anfitriones_registro_draft';

const state = {
  step: 1,
  capacidad: 1,
  aguaActiva: false,
  agua: '',
  vulnerabilidades: [],
  perfil: [],
  fotoDueno: null,
  fotoFachada: null,
};

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    Object.assign(state, draft);
    document.getElementById('nombre_dueno').value = draft.nombre_dueno || '';
    document.getElementById('direccion').value = draft.direccion || '';
    document.getElementById('notas_vulnerabilidad').value = draft.notas_vulnerabilidad || '';
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function saveDraft() {
  const draft = {
    step: state.step,
    capacidad: state.capacidad,
    aguaActiva: state.aguaActiva,
    agua: state.agua,
    vulnerabilidades: state.vulnerabilidades,
    perfil: state.perfil,
    nombre_dueno: document.getElementById('nombre_dueno').value,
    direccion: document.getElementById('direccion').value,
    notas_vulnerabilidad: document.getElementById('notas_vulnerabilidad').value,
    lat: state.lat,
    lng: state.lng,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function renderStep() {
  document.querySelectorAll('.wizard-step').forEach((el) => {
    el.hidden = Number(el.dataset.step) !== state.step;
  });

  document.querySelectorAll('#wizard-steps span').forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle('done', n < state.step);
    el.classList.toggle('current', n === state.step);
    if (n === state.step) {
      el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  });

  document.querySelectorAll('.wizard-progress-bar').forEach((el) => {
    el.classList.toggle('done', Number(el.dataset.bar) <= state.step);
  });

  document.getElementById('atras-btn').style.visibility = state.step === 1 ? 'hidden' : 'visible';
  document.getElementById('siguiente-btn').textContent = state.step === TOTAL_STEPS ? 'Sellar registro' : 'Siguiente';
  document.getElementById('wizard-error').textContent = '';
}

function validateStep() {
  if (state.step === 1) {
    const nombre = document.getElementById('nombre_dueno').value.trim();
    const direccion = document.getElementById('direccion').value.trim();
    if (!nombre || !direccion) {
      return 'Completa el nombre del dueño y la dirección.';
    }
  }
  return null;
}

function updateOfflineBadge() {
  document.getElementById('offline-badge').hidden = navigator.onLine;
}

function initMap() {
  const statusEl = document.getElementById('ubicar-status');
  const hasDraftLocation = typeof state.lat === 'number' && typeof state.lng === 'number';
  const initialCenter = hasDraftLocation ? [state.lat, state.lng] : [20.6597, -103.3496];
  const initialZoom = hasDraftLocation ? 19 : 12;

  const map = L.map('wizard-map').setView(initialCenter, initialZoom);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19,
  }).addTo(map);

  const marker = L.marker(initialCenter, { draggable: true }).addTo(map);

  const updateFromLatLng = (latlng) => {
    state.lat = latlng.lat;
    state.lng = latlng.lng;
    statusEl.textContent = 'Ubicación fijada. Ajusta el pin si no es exacta.';
    saveDraft();
  };

  marker.on('dragend', () => updateFromLatLng(marker.getLatLng()));
  map.on('click', (event) => {
    marker.setLatLng(event.latlng);
    updateFromLatLng(event.latlng);
  });

  if (hasDraftLocation) {
    statusEl.textContent = 'Ubicación fijada. Ajusta el pin si no es exacta.';
    return;
  }

  if (!navigator.geolocation) {
    statusEl.textContent = 'Este dispositivo no soporta ubicación automática. Toca el mapa para fijar el lugar.';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView([latlng.lat, latlng.lng], 19);
      marker.setLatLng(latlng);
      updateFromLatLng(latlng);
    },
    () => {
      statusEl.textContent = 'No se pudo obtener tu ubicación. Mueve el mapa y toca el lugar exacto.';
    }
  );
}

function setupPhotos() {
  const bind = (inputId, labelId, key) => {
    document.getElementById(inputId).addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      state[key] = file;
      const label = document.getElementById(labelId);
      label.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
      label.querySelector('span').textContent = '';
    });
  };
  bind('foto_dueno', 'foto_dueno_label', 'fotoDueno');
  bind('foto_fachada', 'foto_fachada_label', 'fotoFachada');
}

function setupCapacidad() {
  const output = document.getElementById('capacidad-valor');
  const hidden = document.getElementById('capacidad');
  const update = () => {
    output.textContent = state.capacidad;
    hidden.value = state.capacidad;
    saveDraft();
  };
  document.getElementById('capacidad-menos').addEventListener('click', () => {
    state.capacidad = Math.max(1, state.capacidad - 1);
    update();
  });
  document.getElementById('capacidad-mas').addEventListener('click', () => {
    state.capacidad = Math.min(20, state.capacidad + 1);
    update();
  });
  update();
}

function setupAgua() {
  const toggle = document.getElementById('agua-toggle');
  const group = document.getElementById('water-status');
  const hidden = document.getElementById('agua');

  toggle.addEventListener('change', () => {
    state.aguaActiva = toggle.checked;
    group.classList.toggle('visible', state.aguaActiva);
    if (state.aguaActiva && !state.agua) {
      state.agua = 'buena';
    }
    hidden.value = state.aguaActiva ? state.agua : '';
    renderAguaPills();
    saveDraft();
  });

  group.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state.agua = pill.dataset.agua;
      hidden.value = state.agua;
      renderAguaPills();
      saveDraft();
    });
  });
}

function renderAguaPills() {
  document.querySelectorAll('#water-status .pill').forEach((pill) => {
    pill.classList.toggle('selected', pill.dataset.agua === state.agua);
  });
}

function setupMultiSelect(groupId, key) {
  document.querySelectorAll(`#${groupId} .pill`).forEach((pill) => {
    pill.addEventListener('click', () => {
      const value = pill.dataset.vuln || pill.dataset.perfil;
      const list = state[key];
      const idx = list.indexOf(value);
      if (idx >= 0) {
        list.splice(idx, 1);
        pill.classList.remove('selected');
      } else {
        list.push(value);
        pill.classList.add('selected');
      }
      saveDraft();
    });
  });
}

async function handleSubmit() {
  const errorEl = document.getElementById('wizard-error');
  errorEl.textContent = '';

  const formData = new FormData();
  formData.append('nombre_dueno', document.getElementById('nombre_dueno').value.trim());
  formData.append('direccion', document.getElementById('direccion').value.trim());
  if (state.lat) formData.append('lat', state.lat);
  if (state.lng) formData.append('lng', state.lng);
  formData.append('capacidad', state.capacidad);
  formData.append('agua', state.agua || '');
  formData.append('luz', document.getElementById('luz').checked);
  formData.append('electricidad', document.getElementById('electricidad').checked);
  formData.append('vulnerabilidades', JSON.stringify(state.vulnerabilidades));
  formData.append('notas_vulnerabilidad', document.getElementById('notas_vulnerabilidad').value.trim());
  formData.append('perfil_sugerido', JSON.stringify(state.perfil));
  if (state.fotoDueno) formData.append('foto_dueno', state.fotoDueno);
  if (state.fotoFachada) formData.append('foto_fachada', state.fotoFachada);

  const submitBtn = document.getElementById('siguiente-btn');
  submitBtn.disabled = true;
  try {
    await crearHogar(session.token, formData);
    localStorage.removeItem(DRAFT_KEY);
    window.location.href = 'home.html';
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    errorEl.textContent = navigator.onLine
      ? (err.message || 'No se pudo guardar el registro.')
      : 'Sin conexión: tu progreso quedó guardado en este dispositivo. Intenta de nuevo cuando tengas señal.';
  } finally {
    submitBtn.disabled = false;
  }
}

document.getElementById('header-back-btn').addEventListener('click', () => {
  window.location.href = 'home.html';
});

document.getElementById('atras-btn').addEventListener('click', () => {
  if (state.step > 1) {
    state.step -= 1;
    renderStep();
    saveDraft();
  }
});

document.getElementById('siguiente-btn').addEventListener('click', () => {
  const error = validateStep();
  if (error) {
    document.getElementById('wizard-error').textContent = error;
    return;
  }

  if (state.step === TOTAL_STEPS) {
    handleSubmit();
    return;
  }

  state.step += 1;
  renderStep();
  saveDraft();
});

document.getElementById('registro-form').addEventListener('input', saveDraft);

window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);

loadDraft();
initMap();
setupPhotos();
setupCapacidad();
setupAgua();
setupMultiSelect('vulnerabilidades-group', 'vulnerabilidades');
setupMultiSelect('perfil-group', 'perfil');
updateOfflineBadge();
renderStep();

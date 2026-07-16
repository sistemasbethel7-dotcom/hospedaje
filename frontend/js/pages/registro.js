import { registerServiceWorker } from '../app.js';
import { crearHogar, obtenerCatalogosActivos, buscarCodigoPostal } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { getActiveEventId, clearActiveEventId } from '../services/eventoActivo.js';
import { setupMapModal } from '../mapModal.js';
import { compressImage } from '../imageCompress.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

const eventoId = getActiveEventId();
if (!eventoId) {
  window.location.href = 'eventos.html';
}

const TOTAL_STEPS = 6;
const DRAFT_KEY = 'anfitriones_registro_draft';
const STEP_NAMES = ['Datos del dueño', 'Fotografías', 'Capacidad', 'Servicios', 'Vulnerabilidades', 'Perfil recomendado'];

const state = {
  step: 1,
  capacidad: 1,
  tenencia: null,
  servicios: [],
  vulnerabilidades: [],
  perfil: [],
  fotoFachada: null,
};

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (draft.evento_id !== eventoId) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    Object.assign(state, draft);
    document.getElementById('nombre_dueno').value = draft.nombre_dueno || '';
    document.getElementById('telefono_dueno').value = draft.telefono_dueno || '';
    document.getElementById('calle_numero').value = draft.calle_numero || '';
    document.getElementById('colonia').value = draft.colonia || '';
    document.getElementById('codigo_postal').value = draft.codigo_postal || '';
    document.getElementById('estado').value = draft.estado || '';
    document.getElementById('referencias').value = draft.referencias || '';
    document.getElementById('comentarios').value = draft.comentarios || '';
    document.getElementById('notas_vulnerabilidad').value = draft.notas_vulnerabilidad || '';
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function saveDraft() {
  const draft = {
    evento_id: eventoId,
    step: state.step,
    capacidad: state.capacidad,
    tenencia: state.tenencia,
    servicios: state.servicios,
    vulnerabilidades: state.vulnerabilidades,
    perfil: state.perfil,
    nombre_dueno: document.getElementById('nombre_dueno').value,
    telefono_dueno: document.getElementById('telefono_dueno').value,
    calle_numero: document.getElementById('calle_numero').value,
    colonia: document.getElementById('colonia').value,
    codigo_postal: document.getElementById('codigo_postal').value,
    estado: document.getElementById('estado').value,
    referencias: document.getElementById('referencias').value,
    comentarios: document.getElementById('comentarios').value,
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

  document.getElementById('wizard-current-step').textContent = STEP_NAMES[state.step - 1];
  document.getElementById('wizard-step-count').textContent = `${state.step}/${TOTAL_STEPS}`;
  document.getElementById('wizard-progress-fill').style.width = `${(state.step / TOTAL_STEPS) * 100}%`;

  document.getElementById('atras-btn').style.visibility = state.step === 1 ? 'hidden' : 'visible';
  document.getElementById('siguiente-btn').textContent = state.step === TOTAL_STEPS ? 'Sellar registro' : 'Siguiente';
  document.getElementById('wizard-error').textContent = '';
}

function validateStep() {
  if (state.step === 1) {
    const nombre = document.getElementById('nombre_dueno').value.trim();
    const calleNumero = document.getElementById('calle_numero').value.trim();
    const colonia = document.getElementById('colonia').value.trim();
    const estado = document.getElementById('estado').value.trim();
    if (!nombre || !calleNumero || !colonia || !estado) {
      return 'Completa el nombre del dueño, la calle y número, la colonia y el estado.';
    }
    if (!state.tenencia) {
      return 'Indica si la casa es propia o rentada.';
    }
  }
  return null;
}

function renderTenencia() {
  document.querySelectorAll('#tenencia-group .pill').forEach((pill) => {
    pill.classList.toggle('selected', state.tenencia === pill.dataset.tenencia);
  });
}

function setupTenencia() {
  document.querySelectorAll('#tenencia-group .pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      state.tenencia = pill.dataset.tenencia;
      renderTenencia();
      saveDraft();
    });
  });
}

let cpLookupTimeout = null;
let coloniasDisponibles = [];

function renderColoniaDropdown(filtro) {
  const dropdown = document.getElementById('colonia-dropdown');
  dropdown.innerHTML = '';

  if (coloniasDisponibles.length === 0) {
    dropdown.hidden = true;
    return;
  }

  const filtradas = coloniasDisponibles.filter((c) =>
    c.colonia.toLowerCase().includes(filtro.trim().toLowerCase())
  );
  if (filtradas.length === 0) {
    dropdown.hidden = true;
    return;
  }

  filtradas.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'autocomplete-option';
    btn.textContent = c.colonia;
    btn.addEventListener('click', () => {
      document.getElementById('colonia').value = c.colonia;
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      saveDraft();
    });
    dropdown.appendChild(btn);
  });
  dropdown.hidden = false;
}

function setupCodigoPostal() {
  const input = document.getElementById('codigo_postal');
  const hint = document.getElementById('cp-hint');
  const coloniaInput = document.getElementById('colonia');
  const dropdown = document.getElementById('colonia-dropdown');
  const estadoInput = document.getElementById('estado');

  input.addEventListener('input', () => {
    clearTimeout(cpLookupTimeout);
    const cp = input.value.trim();
    if (!/^\d{5}$/.test(cp)) {
      hint.hidden = true;
      coloniasDisponibles = [];
      dropdown.hidden = true;
      return;
    }
    cpLookupTimeout = setTimeout(async () => {
      try {
        const resultado = await buscarCodigoPostal(session.token, cp);
        if (!resultado) {
          coloniasDisponibles = [];
          dropdown.hidden = true;
          hint.hidden = false;
          hint.textContent = 'Código postal no encontrado, ingresa la colonia y el estado a mano.';
          return;
        }
        coloniasDisponibles = resultado.colonias;
        if (!estadoInput.value.trim()) estadoInput.value = resultado.estado;
        hint.hidden = false;
        hint.textContent = `${resultado.colonias.length} colonia(s) encontradas para este código postal.`;
        renderColoniaDropdown(coloniaInput.value);
        saveDraft();
      } catch {
        hint.hidden = true;
      }
    }, 400);
  });

  coloniaInput.addEventListener('input', () => renderColoniaDropdown(coloniaInput.value));
  coloniaInput.addEventListener('focus', () => renderColoniaDropdown(coloniaInput.value));

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.field.has-dropdown')) {
      dropdown.hidden = true;
    }
  });
}

function updateOfflineBadge() {
  document.getElementById('offline-badge').hidden = navigator.onLine;
}

function updateLocationTrigger() {
  const btn = document.getElementById('ubicar-btn');
  const text = document.getElementById('ubicar-trigger-text');
  const hasLocation = typeof state.lat === 'number' && typeof state.lng === 'number';
  btn.classList.toggle('set', hasLocation);
  text.textContent = hasLocation ? 'Ubicación fijada · Toca para ajustar' : 'Ubicar en el mapa';
}

function setupPhotos() {
  const bind = (inputId, labelId, key) => {
    document.getElementById(inputId).addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const compressed = await compressImage(file);
      state[key] = compressed;
      const label = document.getElementById(labelId);
      label.style.backgroundImage = `url(${URL.createObjectURL(compressed)})`;
      label.querySelector('span').textContent = '';
    });
  };
  bind('foto_fachada', 'foto_fachada_label', 'fotoFachada');
}

function setupCapacidad() {
  const input = document.getElementById('capacidad-valor');
  const hidden = document.getElementById('capacidad');
  const clamp = (value) => Math.min(500, Math.max(1, value));
  const update = () => {
    input.value = state.capacidad;
    hidden.value = state.capacidad;
    saveDraft();
  };
  document.getElementById('capacidad-menos').addEventListener('click', () => {
    state.capacidad = clamp(state.capacidad - 1);
    update();
  });
  document.getElementById('capacidad-mas').addEventListener('click', () => {
    state.capacidad = clamp(state.capacidad + 1);
    update();
  });
  input.addEventListener('input', () => {
    const value = parseInt(input.value, 10);
    if (!Number.isNaN(value)) {
      state.capacidad = clamp(value);
      hidden.value = state.capacidad;
      saveDraft();
    }
  });
  input.addEventListener('blur', () => {
    input.value = state.capacidad;
  });
  input.addEventListener('focus', () => input.select());
  update();
}

function renderServicios(items) {
  const container = document.getElementById('servicios-container');
  container.innerHTML = items.map((etiqueta) => `
    <div class="toggle-row">
      <label class="toggle">
        <span class="toggle-label">${etiqueta}</span>
        <input type="checkbox" data-servicio="${etiqueta}">
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
      </label>
    </div>
  `).join('');

  container.querySelectorAll('input[data-servicio]').forEach((checkbox) => {
    checkbox.checked = state.servicios.includes(checkbox.dataset.servicio);
    checkbox.addEventListener('change', () => {
      const value = checkbox.dataset.servicio;
      const idx = state.servicios.indexOf(value);
      if (checkbox.checked && idx < 0) state.servicios.push(value);
      if (!checkbox.checked && idx >= 0) state.servicios.splice(idx, 1);
      saveDraft();
    });
  });
}

function renderPillGroup(containerId, items, key) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map((etiqueta) => `<button type="button" class="pill" data-valor="${etiqueta}">${etiqueta}</button>`)
    .join('');

  container.querySelectorAll('.pill').forEach((pill) => {
    pill.classList.toggle('selected', state[key].includes(pill.dataset.valor));
    pill.addEventListener('click', () => {
      const value = pill.dataset.valor;
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

async function cargarCatalogos() {
  try {
    const { catalogos } = await obtenerCatalogosActivos(session.token);
    return catalogos;
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = 'index.html';
    }
    return { servicio: [], vulnerabilidad: [], perfil: [] };
  }
}

async function handleSubmit() {
  const errorEl = document.getElementById('wizard-error');
  errorEl.textContent = '';

  const formData = new FormData();
  formData.append('evento_id', eventoId);
  formData.append('nombre_dueno', document.getElementById('nombre_dueno').value.trim());
  formData.append('telefono_dueno', document.getElementById('telefono_dueno').value.trim());
  formData.append('calle_numero', document.getElementById('calle_numero').value.trim());
  formData.append('colonia', document.getElementById('colonia').value.trim());
  formData.append('codigo_postal', document.getElementById('codigo_postal').value.trim());
  formData.append('estado', document.getElementById('estado').value.trim());
  formData.append('referencias', document.getElementById('referencias').value.trim());
  if (state.lat) formData.append('lat', state.lat);
  if (state.lng) formData.append('lng', state.lng);
  formData.append('capacidad', state.capacidad);
  formData.append('tenencia', state.tenencia || '');
  formData.append('comentarios', document.getElementById('comentarios').value.trim());
  formData.append('servicios', JSON.stringify(state.servicios));
  formData.append('vulnerabilidades', JSON.stringify(state.vulnerabilidades));
  formData.append('notas_vulnerabilidad', document.getElementById('notas_vulnerabilidad').value.trim());
  formData.append('perfil_sugerido', JSON.stringify(state.perfil));
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
      clearActiveEventId();
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
updateLocationTrigger();
setupMapModal({
  getLocation: () =>
    (typeof state.lat === 'number' && typeof state.lng === 'number' ? { lat: state.lat, lng: state.lng } : null),
  onConfirm: (lat, lng) => {
    state.lat = lat;
    state.lng = lng;
    updateLocationTrigger();
    saveDraft();
  },
});
setupPhotos();
setupCapacidad();
setupTenencia();
renderTenencia();
setupCodigoPostal();
updateOfflineBadge();
renderStep();

const catalogos = await cargarCatalogos();
renderServicios(catalogos.servicio);
renderPillGroup('vulnerabilidades-group', catalogos.vulnerabilidad, 'vulnerabilidades');
renderPillGroup('perfil-group', catalogos.perfil, 'perfil');

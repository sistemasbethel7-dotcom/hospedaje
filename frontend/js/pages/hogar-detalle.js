import { registerServiceWorker } from '../app.js';
import { me, obtenerHogar, actualizarHogar, eliminarHogar, obtenerCatalogosActivos } from '../services/api.js';
import { getSession, clearSession } from '../services/session.js';
import { clearActiveEventId } from '../services/eventoActivo.js';
import { setupMapModal } from '../mapModal.js';
import { compressImage } from '../imageCompress.js';

registerServiceWorker();

const session = getSession();
if (!session) {
  window.location.href = 'index.html';
}

const params = new URLSearchParams(window.location.search);
const hogarId = params.get('id');
if (!hogarId) {
  window.location.href = 'hogares.html';
}

const HOUSE_ICON = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

let hogar = null;
let catalogos = { servicio: [], vulnerabilidad: [], perfil: [] };

const state = {
  lat: null,
  lng: null,
  capacidad: 1,
  servicios: [],
  vulnerabilidades: [],
  perfil: [],
  fotoDueno: null,
  fotoFachada: null,
};

function backToList() {
  window.location.href = params.get('from') === 'admin' ? 'admin/dashboard.html' : 'hogares.html';
}

document.getElementById('back-btn').addEventListener('click', backToList);

function renderView() {
  const photo = document.getElementById('detalle-photo');
  if (hogar.foto_fachada) {
    photo.style.backgroundImage = `url(/uploads/${hogar.foto_fachada})`;
    photo.innerHTML = '';
  } else {
    photo.style.backgroundImage = '';
    photo.innerHTML = HOUSE_ICON;
  }

  document.getElementById('v-nombre').textContent = hogar.nombre_dueno;
  document.getElementById('v-direccion').textContent = `${hogar.calle_numero}, ${hogar.colonia}`;

  const cpEl = document.getElementById('v-cp');
  cpEl.hidden = !hogar.codigo_postal;
  cpEl.textContent = hogar.codigo_postal ? `C.P. ${hogar.codigo_postal}` : '';

  const refEl = document.getElementById('v-referencias');
  refEl.hidden = !hogar.referencias;
  refEl.textContent = hogar.referencias || '';

  document.getElementById('v-capacidad').textContent = `${hogar.ocupacion_actual}/${hogar.capacidad} lugares ocupados`;

  const serviciosCard = document.getElementById('v-servicios-card');
  if (hogar.servicios.length > 0) {
    serviciosCard.hidden = false;
    document.getElementById('v-servicios').innerHTML = hogar.servicios
      .map((s) => `<span class="pill selected">${s}</span>`)
      .join('');
  } else {
    serviciosCard.hidden = true;
  }

  const vulnCard = document.getElementById('v-vulnerabilidades-card');
  if (hogar.vulnerabilidades.length > 0 || hogar.notas_vulnerabilidad) {
    vulnCard.hidden = false;
    document.getElementById('v-vulnerabilidades').innerHTML = hogar.vulnerabilidades
      .map((v) => `<span class="pill selected">${v}</span>`)
      .join('');
    document.getElementById('v-notas').textContent = hogar.notas_vulnerabilidad || '';
  } else {
    vulnCard.hidden = true;
  }

  const perfilCard = document.getElementById('v-perfil-card');
  if (hogar.perfil_sugerido.length > 0) {
    perfilCard.hidden = false;
    document.getElementById('v-perfil').innerHTML = hogar.perfil_sugerido
      .map((p) => `<span class="pill selected">${p}</span>`)
      .join('');
  } else {
    perfilCard.hidden = true;
  }
}

function updateLocationTrigger() {
  const btn = document.getElementById('ubicar-btn');
  const text = document.getElementById('ubicar-trigger-text');
  const hasLocation = typeof state.lat === 'number' && typeof state.lng === 'number';
  btn.classList.toggle('set', hasLocation);
  text.textContent = hasLocation ? 'Ubicación fijada · Toca para ajustar' : 'Ubicar en el mapa';
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
    });
  });
}

function setupCapacidad() {
  const input = document.getElementById('capacidad-valor');
  const hidden = document.getElementById('capacidad');
  const clamp = (value) => Math.min(500, Math.max(1, value));
  const update = () => {
    input.value = state.capacidad;
    hidden.value = state.capacidad;
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
    }
  });
  input.addEventListener('blur', () => {
    input.value = state.capacidad;
  });
  input.addEventListener('focus', () => input.select());
  update();
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
  bind('foto_dueno', 'foto_dueno_label', 'fotoDueno');
  bind('foto_fachada', 'foto_fachada_label', 'fotoFachada');
}

function resetPhotoPreview(labelId, filename, placeholder) {
  const label = document.getElementById(labelId);
  if (filename) {
    label.style.backgroundImage = `url(/uploads/${filename})`;
    label.querySelector('span').textContent = '';
  } else {
    label.style.backgroundImage = '';
    label.querySelector('span').textContent = placeholder;
  }
}

function fillEditForm() {
  document.getElementById('nombre_dueno').value = hogar.nombre_dueno;
  document.getElementById('calle_numero').value = hogar.calle_numero;
  document.getElementById('colonia').value = hogar.colonia;
  document.getElementById('codigo_postal').value = hogar.codigo_postal || '';
  document.getElementById('referencias').value = hogar.referencias || '';

  state.lat = hogar.lat;
  state.lng = hogar.lng;
  updateLocationTrigger();

  state.capacidad = hogar.capacidad;
  document.getElementById('capacidad-valor').value = state.capacidad;
  document.getElementById('capacidad').value = state.capacidad;

  state.servicios = [...hogar.servicios];
  renderServicios(catalogos.servicio);

  state.vulnerabilidades = [...hogar.vulnerabilidades];
  renderPillGroup('vulnerabilidades-group', catalogos.vulnerabilidad, 'vulnerabilidades');
  document.getElementById('notas_vulnerabilidad').value = hogar.notas_vulnerabilidad || '';

  state.perfil = [...hogar.perfil_sugerido];
  renderPillGroup('perfil-group', catalogos.perfil, 'perfil');

  state.fotoDueno = null;
  state.fotoFachada = null;
  resetPhotoPreview('foto_dueno_label', hogar.foto_dueno, 'Dueño');
  resetPhotoPreview('foto_fachada_label', hogar.foto_fachada, 'Fachada');
}

function showView() {
  document.getElementById('view-mode').hidden = false;
  document.getElementById('edit-mode').hidden = true;
  document.getElementById('view-footer').hidden = false;
  document.getElementById('edit-footer').hidden = true;
  document.getElementById('detalle-error').textContent = '';
}

function showEdit() {
  fillEditForm();
  document.getElementById('view-mode').hidden = true;
  document.getElementById('edit-mode').hidden = false;
  document.getElementById('view-footer').hidden = true;
  document.getElementById('edit-footer').hidden = false;
  document.getElementById('detalle-error').textContent = '';
}

async function handleGuardar() {
  const errorEl = document.getElementById('detalle-error');
  errorEl.textContent = '';

  const nombre = document.getElementById('nombre_dueno').value.trim();
  const calleNumero = document.getElementById('calle_numero').value.trim();
  const colonia = document.getElementById('colonia').value.trim();
  if (!nombre || !calleNumero || !colonia) {
    errorEl.textContent = 'Completa el nombre del dueño, la calle y número, y la colonia.';
    return;
  }

  const formData = new FormData();
  formData.append('nombre_dueno', nombre);
  formData.append('calle_numero', calleNumero);
  formData.append('colonia', colonia);
  formData.append('codigo_postal', document.getElementById('codigo_postal').value.trim());
  formData.append('referencias', document.getElementById('referencias').value.trim());
  if (state.lat) formData.append('lat', state.lat);
  if (state.lng) formData.append('lng', state.lng);
  formData.append('capacidad', state.capacidad);
  formData.append('servicios', JSON.stringify(state.servicios));
  formData.append('vulnerabilidades', JSON.stringify(state.vulnerabilidades));
  formData.append('notas_vulnerabilidad', document.getElementById('notas_vulnerabilidad').value.trim());
  formData.append('perfil_sugerido', JSON.stringify(state.perfil));
  if (state.fotoDueno) formData.append('foto_dueno', state.fotoDueno);
  if (state.fotoFachada) formData.append('foto_fachada', state.fotoFachada);

  const guardarBtn = document.getElementById('guardar-btn');
  guardarBtn.disabled = true;
  try {
    await actualizarHogar(session.token, hogarId, formData);
    const refreshed = await obtenerHogar(session.token, hogarId);
    hogar = refreshed.hogar;
    renderView();
    showView();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = 'index.html';
      return;
    }
    errorEl.textContent = err.message || 'No se pudo actualizar el registro.';
  } finally {
    guardarBtn.disabled = false;
  }
}

async function handleEliminar() {
  if (!confirm('¿Seguro que quieres eliminar este hogar? Esta acción no se puede deshacer.')) {
    return;
  }
  const eliminarBtn = document.getElementById('eliminar-btn');
  eliminarBtn.disabled = true;
  try {
    await eliminarHogar(session.token, hogarId);
    backToList();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      clearActiveEventId();
      window.location.href = 'index.html';
      return;
    }
    document.getElementById('detalle-error').textContent = err.message || 'No se pudo eliminar el registro.';
    eliminarBtn.disabled = false;
  }
}

document.getElementById('editar-btn').addEventListener('click', showEdit);
document.getElementById('cancelar-btn').addEventListener('click', showView);
document.getElementById('guardar-btn').addEventListener('click', handleGuardar);
document.getElementById('eliminar-btn').addEventListener('click', handleEliminar);

setupMapModal({
  getLocation: () =>
    (typeof state.lat === 'number' && typeof state.lng === 'number' ? { lat: state.lat, lng: state.lng } : null),
  onConfirm: (lat, lng) => {
    state.lat = lat;
    state.lng = lng;
    updateLocationTrigger();
  },
});
setupPhotos();
setupCapacidad();

try {
  const [{ user }, data, catalogosResp] = await Promise.all([
    me(session.token),
    obtenerHogar(session.token, hogarId),
    obtenerCatalogosActivos(session.token),
  ]);
  hogar = data.hogar;
  catalogos = catalogosResp.catalogos;
  renderView();
  showView();
  if (user.role === 'supervisor' || params.get('soloLectura') === '1') {
    document.getElementById('editar-btn').hidden = true;
    document.getElementById('eliminar-btn').hidden = true;
  }
} catch (err) {
  if (err.status === 401) {
    clearSession();
    clearActiveEventId();
    window.location.href = 'index.html';
  } else {
    document.getElementById('detalle-error').textContent = 'No se pudo cargar el registro.';
  }
}

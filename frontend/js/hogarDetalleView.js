export const HOUSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

export function estatusHogar(h) {
  if (h.ocupacion_actual <= 0) return 'libre';
  if (h.ocupacion_actual >= h.capacidad) return 'lleno';
  return 'parcial';
}

export function estatusLabel(estatus) {
  if (estatus === 'libre') return 'Libre';
  if (estatus === 'lleno') return 'Lleno';
  return 'Parcial';
}

export function folioDe(id) {
  return `H-${String(id).padStart(6, '0')}`;
}

export function renderHogaresTablaHTML(hogares) {
  if (!hogares || hogares.length === 0) {
    return '<p class="admin-modal-empty">No se encontraron hogares.</p>';
  }

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Folio</th>
            <th>Dueño</th>
            <th>Dirección</th>
            <th>C.P.</th>
            <th>Ocupación</th>
            <th>Estatus</th>
          </tr>
        </thead>
        <tbody>
          ${hogares
            .map((h) => {
              const thumbStyle = h.foto_fachada ? `style="background-image:url(/uploads/${h.foto_fachada})"` : '';
              const thumbContent = h.foto_fachada ? '' : HOUSE_ICON;
              const estatus = estatusHogar(h);
              return `
                <tr class="clickable" data-hogar-id="${h.id}">
                  <td><div class="admin-table-thumb" ${thumbStyle}>${thumbContent}</div></td>
                  <td>${folioDe(h.id)}</td>
                  <td>${escapeHtml(h.nombre_dueno)}</td>
                  <td>${escapeHtml(h.calle_numero)}, ${escapeHtml(h.colonia)}</td>
                  <td>${h.codigo_postal ? escapeHtml(h.codigo_postal) : '—'}</td>
                  <td>${h.ocupacion_actual}/${h.capacidad}</td>
                  <td><span class="admin-estado-badge ${estatus}">${estatusLabel(estatus)}</span></td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderDetalleHogarHTML(hogar) {
  const fotoStyle = hogar.foto_fachada ? `style="background-image:url(/uploads/${hogar.foto_fachada})"` : '';
  const fotoContent = hogar.foto_fachada ? '' : HOUSE_ICON;
  const estatus = estatusHogar(hogar);

  const seccion = (titulo, items) => {
    if (!items || items.length === 0) return '';
    return `
      <div class="admin-detalle-section">
        <span class="label-caps">${titulo}</span>
        <div class="admin-pill-group">${items.map((i) => `<span class="admin-pill">${escapeHtml(i)}</span>`).join('')}</div>
      </div>
    `;
  };

  return `
    <div class="admin-detalle-photo" ${fotoStyle}>${fotoContent}</div>
    <div class="admin-detalle-direccion">${escapeHtml(hogar.calle_numero)}, ${escapeHtml(hogar.colonia)}${hogar.estado ? `, ${escapeHtml(hogar.estado)}` : ''}</div>
    <div class="admin-detalle-grid">
      <div>
        <span class="label-caps">Teléfono</span>
        <span class="valor">${hogar.telefono_dueno ? `<a href="tel:${escapeHtml(hogar.telefono_dueno)}">${escapeHtml(hogar.telefono_dueno)}</a>` : '—'}</span>
      </div>
      <div>
        <span class="label-caps">C.P.</span>
        <span class="valor">${hogar.codigo_postal ? escapeHtml(hogar.codigo_postal) : '—'}</span>
      </div>
      <div>
        <span class="label-caps">Referencias</span>
        <span class="valor">${hogar.referencias ? escapeHtml(hogar.referencias) : '—'}</span>
      </div>
      <div>
        <span class="label-caps">Ocupación</span>
        <span class="valor">${hogar.ocupacion_actual}/${hogar.capacidad} <span class="admin-estado-badge ${estatus}">${estatusLabel(estatus)}</span></span>
      </div>
    </div>
    ${seccion('Servicios', hogar.servicios)}
    ${seccion('Vulnerabilidades', hogar.vulnerabilidades)}
    ${hogar.notas_vulnerabilidad ? `<p class="admin-detalle-notas">${escapeHtml(hogar.notas_vulnerabilidad)}</p>` : ''}
    ${seccion('Perfil recomendado', hogar.perfil_sugerido)}
  `;
}

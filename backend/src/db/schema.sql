CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles: admin (acceso total), agente (registra en campo), supervisor (ve y valida el dashboard)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE usuarios SET role = 'admin' WHERE role IS NULL;
ALTER TABLE usuarios ALTER COLUMN role SET NOT NULL;
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_role_check CHECK (role IN ('admin', 'agente', 'supervisor'));

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- Nombre y teléfono del usuario (opcionales, agregados para identificación rápida en el dashboard).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Alta por invitación: el admin crea el usuario sin contraseña, se manda un correo con un
-- link de un solo uso (token con expiración) para que el usuario defina su propia contraseña.
ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS setup_token_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS setup_token_expires TIMESTAMPTZ;

GRANT ALL PRIVILEGES ON TABLE usuarios TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE usuarios_id_seq TO pwa_templo_app;

CREATE TABLE IF NOT EXISTS eventos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  sede TEXT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'abierto',
  creado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estatus_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_estatus_check CHECK (estatus IN ('abierto', 'finalizado'));

GRANT ALL PRIVILEGES ON TABLE eventos TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE eventos_id_seq TO pwa_templo_app;

CREATE TABLE IF NOT EXISTS hogares (
  id SERIAL PRIMARY KEY,
  nombre_dueno TEXT NOT NULL,
  direccion TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  capacidad INTEGER NOT NULL DEFAULT 1,
  foto_dueno TEXT,
  foto_fachada TEXT,
  agua TEXT CHECK (agua IN ('buena', 'intermitente', 'sin_servicio')),
  luz BOOLEAN NOT NULL DEFAULT false,
  electricidad BOOLEAN NOT NULL DEFAULT false,
  vulnerabilidades TEXT[] NOT NULL DEFAULT '{}',
  notas_vulnerabilidad TEXT,
  perfil_sugerido TEXT[] NOT NULL DEFAULT '{}',
  registrado_por INTEGER REFERENCES usuarios(id),
  validado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE hogares ADD COLUMN IF NOT EXISTS ocupacion_actual INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ingresos (
  id SERIAL PRIMARY KEY,
  hogar_id INTEGER NOT NULL REFERENCES hogares(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  registrado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL PRIVILEGES ON TABLE ingresos TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE ingresos_id_seq TO pwa_templo_app;

-- Cada hogar pertenece a un evento; se purgan filas huérfanas previas a este cambio (sin datos reales que preservar)
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS evento_id INTEGER REFERENCES eventos(id);
DELETE FROM ingresos WHERE hogar_id IN (SELECT id FROM hogares WHERE evento_id IS NULL);
DELETE FROM hogares WHERE evento_id IS NULL;
ALTER TABLE hogares ALTER COLUMN evento_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hogares_evento_id ON hogares (evento_id);

-- Dirección atomizada (antes un solo campo "direccion") para poder filtrar por colonia/calle/CP
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS calle_numero TEXT;
UPDATE hogares SET calle_numero = 'Sin especificar' WHERE calle_numero IS NULL;
ALTER TABLE hogares ALTER COLUMN calle_numero SET NOT NULL;

ALTER TABLE hogares ADD COLUMN IF NOT EXISTS colonia TEXT;
UPDATE hogares SET colonia = 'Sin especificar' WHERE colonia IS NULL;
ALTER TABLE hogares ALTER COLUMN colonia SET NOT NULL;

ALTER TABLE hogares ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS referencias TEXT;
ALTER TABLE hogares DROP COLUMN IF EXISTS direccion;

ALTER TABLE hogares ADD COLUMN IF NOT EXISTS telefono_dueno TEXT;

GRANT ALL PRIVILEGES ON TABLE hogares TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE hogares_id_seq TO pwa_templo_app;

-- Catálogos configurables por el admin (servicios, vulnerabilidades, perfiles) en vez de listas
-- fijas en el código del wizard. Globales (compartidos por todos los eventos), no por evento.
CREATE TABLE IF NOT EXISTS catalogos (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,
  etiqueta TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE catalogos DROP CONSTRAINT IF EXISTS catalogos_tipo_check;
ALTER TABLE catalogos ADD CONSTRAINT catalogos_tipo_check CHECK (tipo IN ('servicio', 'vulnerabilidad', 'perfil'));
CREATE INDEX IF NOT EXISTS idx_catalogos_tipo ON catalogos (tipo);

GRANT ALL PRIVILEGES ON TABLE catalogos TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE catalogos_id_seq TO pwa_templo_app;

-- Semilla inicial: lo que antes era estático en el wizard. Solo se inserta si ese tipo
-- está vacío, así el admin puede vaciarlo por completo después sin que se re-semille.
INSERT INTO catalogos (tipo, etiqueta, orden)
SELECT 'servicio', etiqueta, orden FROM (VALUES ('Agua', 1), ('Luz', 2), ('Electricidad', 3)) AS s(etiqueta, orden)
WHERE NOT EXISTS (SELECT 1 FROM catalogos WHERE tipo = 'servicio');

INSERT INTO catalogos (tipo, etiqueta, orden)
SELECT 'vulnerabilidad', etiqueta, orden FROM (VALUES
  ('Acceso complicado', 1),
  ('Zona insegura', 2),
  ('Sin salida de emergencia', 3),
  ('Iluminación deficiente', 4),
  ('Mascotas sueltas', 5)
) AS v(etiqueta, orden)
WHERE NOT EXISTS (SELECT 1 FROM catalogos WHERE tipo = 'vulnerabilidad');

INSERT INTO catalogos (tipo, etiqueta, orden)
SELECT 'perfil', etiqueta, orden FROM (VALUES
  ('Familia con niños', 1),
  ('Adultos mayores', 2),
  ('Matrimonios', 3)
) AS p(etiqueta, orden)
WHERE NOT EXISTS (SELECT 1 FROM catalogos WHERE tipo = 'perfil');

-- Servicios de la casa: antes columnas fijas (agua con 3 estados, luz, electricidad),
-- ahora una lista abierta que el admin define en catalogos. Se guarda como snapshot de
-- etiquetas (igual patrón que vulnerabilidades/perfil_sugerido), no como referencia.
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS servicios TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hogares' AND column_name = 'agua') THEN
    UPDATE hogares SET servicios = (
      (CASE WHEN agua IS NOT NULL AND agua <> 'sin_servicio' THEN ARRAY['Agua'] ELSE ARRAY[]::TEXT[] END) ||
      (CASE WHEN luz THEN ARRAY['Luz'] ELSE ARRAY[]::TEXT[] END) ||
      (CASE WHEN electricidad THEN ARRAY['Electricidad'] ELSE ARRAY[]::TEXT[] END)
    ) WHERE servicios = '{}';
    ALTER TABLE hogares DROP COLUMN agua;
    ALTER TABLE hogares DROP COLUMN luz;
    ALTER TABLE hogares DROP COLUMN electricidad;
  END IF;
END $$;

ALTER TABLE hogares ADD COLUMN IF NOT EXISTS estado TEXT;

-- Tenencia de la casa. NULL permitido para hogares registrados antes de este campo.
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS tenencia TEXT;
ALTER TABLE hogares DROP CONSTRAINT IF EXISTS hogares_tenencia_check;
ALTER TABLE hogares ADD CONSTRAINT hogares_tenencia_check CHECK (tenencia IN ('Propia', 'Rentada'));

-- Comentarios libres sobre el hogar (observaciones generales del agente).
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS comentarios TEXT;

-- Folio del sistema de origen cuando el hogar viene de una importación (ej. MIRH-123 del
-- Excel de zona). No sustituye al folio propio (H-000123, derivado del id).
ALTER TABLE hogares ADD COLUMN IF NOT EXISTS folio_anterior TEXT;

-- Catálogo de códigos postales (SEPOMEX/Correos de México, importado localmente para no
-- depender de un servicio externo el día del evento). Se puebla con
-- backend/scripts/import-codigos-postales.js, no con este archivo (150k+ filas).
CREATE TABLE IF NOT EXISTS codigos_postales (
  id SERIAL PRIMARY KEY,
  cp TEXT NOT NULL,
  colonia TEXT NOT NULL,
  tipo_asentamiento TEXT,
  municipio TEXT,
  estado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codigos_postales_cp ON codigos_postales (cp);

GRANT ALL PRIVILEGES ON TABLE codigos_postales TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE codigos_postales_id_seq TO pwa_templo_app;

-- Permitir eliminar usuarios sin romper datos históricos: SET NULL en las FK.
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_creado_por_fkey;
ALTER TABLE eventos ADD CONSTRAINT eventos_creado_por_fkey
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE hogares DROP CONSTRAINT IF EXISTS hogares_registrado_por_fkey;
ALTER TABLE hogares ADD CONSTRAINT hogares_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ingresos DROP CONSTRAINT IF EXISTS ingresos_registrado_por_fkey;
ALTER TABLE ingresos ADD CONSTRAINT ingresos_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- Configuración global del agente de voz (una sola fila, id fijo en 1).
CREATE TABLE IF NOT EXISTS agente_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  habilitado BOOLEAN NOT NULL DEFAULT true,
  voz TEXT NOT NULL DEFAULT 'marin',
  acento_estilo TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO agente_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT ALL PRIVILEGES ON TABLE agente_config TO pwa_templo_app;

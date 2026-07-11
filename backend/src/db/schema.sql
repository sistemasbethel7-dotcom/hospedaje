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

GRANT ALL PRIVILEGES ON TABLE usuarios TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE usuarios_id_seq TO pwa_templo_app;

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

GRANT ALL PRIVILEGES ON TABLE hogares TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE hogares_id_seq TO pwa_templo_app;

CREATE TABLE IF NOT EXISTS ingresos (
  id SERIAL PRIMARY KEY,
  hogar_id INTEGER NOT NULL REFERENCES hogares(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  registrado_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL PRIVILEGES ON TABLE ingresos TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE ingresos_id_seq TO pwa_templo_app;

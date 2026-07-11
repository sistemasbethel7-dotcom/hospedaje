CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL PRIVILEGES ON TABLE usuarios TO pwa_templo_app;
GRANT USAGE, SELECT ON SEQUENCE usuarios_id_seq TO pwa_templo_app;

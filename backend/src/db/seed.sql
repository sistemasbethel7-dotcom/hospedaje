INSERT INTO usuarios (email, password_hash, role) VALUES
  ('admin@lldmhospedaje.tech', '$2a$10$.PAwKmXvGpsWk4r2ZBsEF.1pFTZu0.VzpFQxO5bZYW4r1dral2Wji', 'admin'),
  ('agente@lldmhospedaje.tech', '$2a$10$kYmGQnK3eYw/jETBZijBN.cxFXyQgmeZNNeMdpcAjc6avgWT1CMw.', 'agente'),
  ('supervisor@lldmhospedaje.tech', '$2a$10$.cGuaKYwrLFqSy.mFeAoc.pEualsSQDRNu39qpZjXf7cU5r2wCAU.', 'supervisor')
ON CONFLICT (email) DO NOTHING;

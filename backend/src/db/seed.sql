INSERT INTO usuarios (email, password_hash)
VALUES ('admin@lldmhospedaje.tech', '$2a$10$.PAwKmXvGpsWk4r2ZBsEF.1pFTZu0.VzpFQxO5bZYW4r1dral2Wji')
ON CONFLICT (email) DO NOTHING;

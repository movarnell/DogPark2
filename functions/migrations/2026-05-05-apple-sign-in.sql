ALTER TABLE users
  ADD COLUMN apple_sub VARCHAR(255) NULL UNIQUE AFTER google_sub;

CREATE INDEX idx_users_apple_sub ON users (apple_sub);

ALTER TABLE users
  ADD COLUMN google_sub VARCHAR(255) NULL UNIQUE AFTER password_hash,
  ADD COLUMN avatar_url VARCHAR(1000) NULL AFTER google_sub;

CREATE INDEX idx_users_google_sub ON users (google_sub);

ALTER TABLE dogs
  ADD COLUMN breed_key VARCHAR(160) NULL AFTER breed,
  ADD INDEX idx_dogs_breed_key (breed_key);

CREATE TABLE IF NOT EXISTS media_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_ref VARCHAR(80) NOT NULL,
  purpose VARCHAR(60) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  data MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_media_owner_ref (owner_ref),
  INDEX idx_media_created_at (created_at)
);

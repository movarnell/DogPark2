ALTER TABLE visits
  ADD COLUMN social_intent VARCHAR(80) NULL AFTER notes;

CREATE TABLE IF NOT EXISTS visit_interests (
  visit_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_id, user_id),
  CONSTRAINT fk_visit_interests_visit FOREIGN KEY (visit_id) REFERENCES visits(id),
  CONSTRAINT fk_visit_interests_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_visit_interests_user_id (user_id)
);

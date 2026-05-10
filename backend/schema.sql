CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  google_sub VARCHAR(255) NULL UNIQUE,
  apple_sub VARCHAR(255) NULL UNIQUE,
  avatar_url VARCHAR(1000) NULL,
  role ENUM('member', 'moderator', 'admin') NOT NULL DEFAULT 'member',
  bio TEXT NULL,
  home_city VARCHAR(160) NULL,
  messages_enabled TINYINT(1) NOT NULL DEFAULT 1,
  activity_visibility ENUM('owner_and_dog', 'dog_only', 'anonymous') NOT NULL DEFAULT 'owner_and_dog',
  notification_preferences JSON NULL,
  last_login_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_google_sub (google_sub),
  INDEX idx_users_apple_sub (apple_sub),
  INDEX idx_users_deleted_at (deleted_at)
);

CREATE TABLE IF NOT EXISTS parks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NULL,
  park_name VARCHAR(255) NULL,
  google_place_id VARCHAR(255) NULL UNIQUE,
  address VARCHAR(500) NOT NULL,
  city VARCHAR(160) NULL,
  state VARCHAR(80) NULL,
  location VARCHAR(255) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  size VARCHAR(80) NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  amenities JSON NULL,
  notes TEXT NULL,
  description TEXT NULL,
  image_url VARCHAR(1000) NULL,
  image_URL VARCHAR(1000) NULL,
  fence_status VARCHAR(80) NULL,
  small_dog_area TINYINT(1) NOT NULL DEFAULT 0,
  large_dog_area TINYINT(1) NOT NULL DEFAULT 0,
  water_available TINYINT(1) NOT NULL DEFAULT 0,
  shade_available TINYINT(1) NOT NULL DEFAULT 0,
  lighting_available TINYINT(1) NOT NULL DEFAULT 0,
  surface VARCHAR(120) NULL,
  accessibility_notes TEXT NULL,
  safety_notes TEXT NULL,
  rules TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_parks_search (name, park_name, address, city, state, location),
  INDEX idx_parks_google_place_id (google_place_id),
  INDEX idx_parks_location (latitude, longitude),
  INDEX idx_parks_city_state (city, state)
);

CREATE TABLE IF NOT EXISTS park_place_refs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  google_place_id VARCHAR(255) NOT NULL UNIQUE,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_place_refs_last_seen_at (last_seen_at)
);

CREATE TABLE IF NOT EXISTS dogs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  size ENUM('small', 'medium', 'large', 'giant') NOT NULL DEFAULT 'medium',
  breed VARCHAR(160) NULL,
  breed_key VARCHAR(160) NULL,
  avatar_url VARCHAR(1000) NULL,
  energy_level ENUM('low', 'moderate', 'high') NOT NULL DEFAULT 'moderate',
  play_style ENUM('gentle', 'balanced', 'rough') NOT NULL DEFAULT 'balanced',
  social_comfort ENUM('shy', 'selective', 'social') NOT NULL DEFAULT 'social',
  preferred_dog_sizes JSON NULL,
  is_friendly TINYINT(1) NOT NULL DEFAULT 1,
  is_puppy TINYINT(1) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dogs_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_dogs_owner_id (owner_id),
  INDEX idx_dogs_breed_key (breed_key),
  INDEX idx_dogs_deleted_at (deleted_at)
);

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

CREATE TABLE IF NOT EXISTS visits (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  park_ref VARCHAR(255) NOT NULL,
  dog_id CHAR(36) NULL,
  starts_at DATETIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  status ENUM('planned', 'checked_in', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  social_intent VARCHAR(80) NULL,
  checked_in_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_visits_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_visits_dog FOREIGN KEY (dog_id) REFERENCES dogs(id),
  INDEX idx_visits_park_ref (park_ref),
  INDEX idx_visits_user_id (user_id),
  INDEX idx_visits_starts_at (starts_at)
);

CREATE TABLE IF NOT EXISTS visit_interests (
  visit_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_id, user_id),
  CONSTRAINT fk_visit_interests_visit FOREIGN KEY (visit_id) REFERENCES visits(id),
  CONSTRAINT fk_visit_interests_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_visit_interests_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  park_ref VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(180) NULL,
  body TEXT NOT NULL,
  helpful_count INT NOT NULL DEFAULT 0,
  status ENUM('published', 'pending', 'hidden', 'removed') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_reviews_user_park (park_ref, user_id),
  INDEX idx_reviews_park_ref (park_ref),
  INDEX idx_reviews_status (status),
  INDEX idx_reviews_rating (rating)
);

CREATE TABLE IF NOT EXISTS review_votes (
  review_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id, user_id),
  CONSTRAINT fk_review_votes_review FOREIGN KEY (review_id) REFERENCES reviews(id),
  CONSTRAINT fk_review_votes_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS photos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  park_ref VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  caption VARCHAR(500) NULL,
  status ENUM('pending', 'approved', 'hidden', 'removed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_photos_park_ref (park_ref),
  INDEX idx_photos_status (status)
);

CREATE TABLE IF NOT EXISTS park_suggestions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  park_ref VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  summary VARCHAR(500) NOT NULL,
  suggested_data JSON NULL,
  status ENUM('open', 'accepted', 'rejected') NOT NULL DEFAULT 'open',
  moderator_user_id BIGINT UNSIGNED NULL,
  moderator_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_park_suggestions_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_park_suggestions_status (status),
  INDEX idx_park_suggestions_park_ref (park_ref)
);

CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reporter_user_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('park', 'review', 'photo', 'user', 'visit', 'suggestion') NOT NULL,
  target_id VARCHAR(255) NOT NULL,
  reason VARCHAR(160) NOT NULL,
  details TEXT NULL,
  status ENUM('open', 'reviewing', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  moderator_user_id BIGINT UNSIGNED NULL,
  moderator_notes TEXT NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id),
  INDEX idx_reports_status (status),
  INDEX idx_reports_target (target_type, target_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id BIGINT UNSIGNED NOT NULL,
  followed_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_user_id, followed_user_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_user_id) REFERENCES users(id),
  CONSTRAINT fk_follows_followed FOREIGN KEY (followed_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id BIGINT UNSIGNED NOT NULL,
  blocked_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_user_id) REFERENCES users(id),
  CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_user_id) REFERENCES users(id),
  INDEX idx_user_blocks_blocked_user_id (blocked_user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id CHAR(36) NOT NULL PRIMARY KEY,
  requester_user_id BIGINT UNSIGNED NOT NULL,
  addressee_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
  responded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_friendships_requester FOREIGN KEY (requester_user_id) REFERENCES users(id),
  CONSTRAINT fk_friendships_addressee FOREIGN KEY (addressee_user_id) REFERENCES users(id),
  INDEX idx_friendships_requester (requester_user_id, status),
  INDEX idx_friendships_addressee (addressee_user_id, status)
);

CREATE TABLE IF NOT EXISTS direct_conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_one_id BIGINT UNSIGNED NOT NULL,
  user_two_id BIGINT UNSIGNED NOT NULL,
  created_from_visit_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_direct_conversations_user_one FOREIGN KEY (user_one_id) REFERENCES users(id),
  CONSTRAINT fk_direct_conversations_user_two FOREIGN KEY (user_two_id) REFERENCES users(id),
  CONSTRAINT fk_direct_conversations_visit FOREIGN KEY (created_from_visit_id) REFERENCES visits(id),
  UNIQUE KEY uq_direct_conversation_pair (user_one_id, user_two_id),
  INDEX idx_direct_conversations_user_two (user_two_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender_user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_direct_messages_conversation FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id),
  CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
  INDEX idx_direct_messages_conversation_created (conversation_id, created_at),
  INDEX idx_direct_messages_sender (sender_user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notifications_user_read (user_id, read_at),
  INDEX idx_notifications_created_at (created_at)
);

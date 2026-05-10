ALTER TABLE users
  ADD COLUMN messages_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN activity_visibility ENUM('owner_and_dog', 'dog_only', 'anonymous') NOT NULL DEFAULT 'owner_and_dog';

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

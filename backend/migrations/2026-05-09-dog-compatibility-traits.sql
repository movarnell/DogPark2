ALTER TABLE dogs
  ADD COLUMN energy_level ENUM('low', 'moderate', 'high') NOT NULL DEFAULT 'moderate' AFTER avatar_url,
  ADD COLUMN play_style ENUM('gentle', 'balanced', 'rough') NOT NULL DEFAULT 'balanced' AFTER energy_level,
  ADD COLUMN social_comfort ENUM('shy', 'selective', 'social') NOT NULL DEFAULT 'social' AFTER play_style,
  ADD COLUMN preferred_dog_sizes JSON NULL AFTER social_comfort;

-- Metaball: add fill settings
ALTER TABLE app_metaball_patterns
  ADD COLUMN fill_set_index INTEGER NOT NULL DEFAULT -1,
  ADD COLUMN fill_color TEXT NOT NULL DEFAULT '#F0EEE9';

-- Pattern (Jitter Lattice): add missing randomization + font settings
ALTER TABLE app_patterns
  ADD COLUMN slogan_font TEXT,
  ADD COLUMN weight_random BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN rotation_random REAL NOT NULL DEFAULT 0,
  ADD COLUMN position_random REAL NOT NULL DEFAULT 0,
  ADD COLUMN random_seed INTEGER NOT NULL DEFAULT 0;

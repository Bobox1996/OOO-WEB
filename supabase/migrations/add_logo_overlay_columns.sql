-- Logo overlay settings for all pattern tables
ALTER TABLE app_metaball_patterns
  ADD COLUMN logo_url TEXT,
  ADD COLUMN logo_fill_color TEXT,
  ADD COLUMN logo_stroke_color TEXT,
  ADD COLUMN logo_stroke_width REAL;

ALTER TABLE app_patterns
  ADD COLUMN logo_url TEXT,
  ADD COLUMN logo_fill_color TEXT,
  ADD COLUMN logo_stroke_color TEXT,
  ADD COLUMN logo_stroke_width REAL;

ALTER TABLE app_asawa_patterns
  ADD COLUMN logo_url TEXT,
  ADD COLUMN logo_fill_color TEXT,
  ADD COLUMN logo_stroke_color TEXT,
  ADD COLUMN logo_stroke_width REAL,
  ADD COLUMN fill_opacity_random BOOLEAN NOT NULL DEFAULT TRUE;

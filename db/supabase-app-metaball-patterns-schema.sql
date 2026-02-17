-- App Metaball Patterns table for storing user metaball isocurve pattern generations with settings
CREATE TABLE app_metaball_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL,
  charge_count INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  accuracy DECIMAL NOT NULL,
  stroke_weight DECIMAL NOT NULL,
  stroke_color TEXT NOT NULL,
  svg_preview TEXT NOT NULL,  -- Base64 encoded SVG for thumbnail
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_app_metaball_patterns_user_id ON app_metaball_patterns(user_id);
CREATE INDEX idx_app_metaball_patterns_pinned ON app_metaball_patterns(pinned);
CREATE INDEX idx_app_metaball_patterns_created_at ON app_metaball_patterns(created_at DESC);

-- Enable Row Level Security
ALTER TABLE app_metaball_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own patterns
CREATE POLICY "Users can view their own metaball patterns"
  ON app_metaball_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metaball patterns"
  ON app_metaball_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metaball patterns"
  ON app_metaball_patterns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own metaball patterns"
  ON app_metaball_patterns FOR DELETE
  USING (auth.uid() = user_id);

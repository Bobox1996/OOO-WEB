-- App Patterns table for storing user pattern generations with settings
CREATE TABLE app_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  columns INTEGER NOT NULL,
  rows INTEGER NOT NULL,
  stroke_weight DECIMAL NOT NULL,
  stroke_color TEXT NOT NULL,
  slogan TEXT,
  slogan_weight INTEGER,
  slogan_color TEXT,
  svg_preview TEXT NOT NULL,  -- Base64 encoded SVG for thumbnail
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_app_patterns_user_id ON app_patterns(user_id);
CREATE INDEX idx_app_patterns_pinned ON app_patterns(pinned);
CREATE INDEX idx_app_patterns_created_at ON app_patterns(created_at DESC);

-- Enable Row Level Security
ALTER TABLE app_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own patterns
CREATE POLICY "Users can view their own patterns"
  ON app_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns"
  ON app_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns"
  ON app_patterns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patterns"
  ON app_patterns FOR DELETE
  USING (auth.uid() = user_id);

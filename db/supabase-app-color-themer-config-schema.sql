-- Schema for app_color_themer_config table
-- Run this in your Supabase SQL editor

-- Single-row config table for the Color Themer prompt template
CREATE TABLE IF NOT EXISTS app_color_themer_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_template TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_color_themer_config ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users (admins) can manage, app users can read
CREATE POLICY "Allow authenticated read on app_color_themer_config" ON app_color_themer_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on app_color_themer_config" ON app_color_themer_config
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on app_color_themer_config" ON app_color_themer_config
  FOR UPDATE TO authenticated USING (true);

-- Insert default row
INSERT INTO app_color_themer_config (prompt_template) VALUES (
  '{"instruction": "Analyze this image and extract the dominant color palette. Return exactly 6 hex color codes that best represent the image colors, from most dominant to least dominant. Format your response as a JSON array of hex color strings, e.g. [\"#FF5733\", \"#C70039\", ...]. Only return the JSON array, nothing else."}'
);

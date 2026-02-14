-- Schema for app_assets table
-- Run this in your Supabase SQL editor

-- Create app_assets table for storing images with category and prompt
CREATE TABLE IF NOT EXISTS app_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_assets_category ON app_assets(category);
CREATE INDEX IF NOT EXISTS idx_app_assets_created_at ON app_assets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE app_assets ENABLE ROW LEVEL SECURITY;

-- Policies for app_assets table
-- Only authenticated users (admins) can manage app_assets
CREATE POLICY "Allow authenticated read on app_assets" ON app_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on app_assets" ON app_assets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on app_assets" ON app_assets
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on app_assets" ON app_assets
  FOR DELETE TO authenticated USING (true);

-- Also allow public read access for app users to use assets
CREATE POLICY "Allow public read on app_assets" ON app_assets
  FOR SELECT TO anon USING (true);

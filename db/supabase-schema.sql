-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  cover_image_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on projects" ON projects
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on images" ON images
  FOR SELECT USING (true);

-- Create policies for authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to insert projects" ON projects
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update projects" ON projects
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete projects" ON projects
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert images" ON images
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update images" ON images
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete images" ON images
  FOR DELETE TO authenticated USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members
CREATE POLICY "Allow public read access on team_members" ON team_members
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert team_members" ON team_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update team_members" ON team_members
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete team_members" ON team_members
  FOR DELETE TO authenticated USING (true);

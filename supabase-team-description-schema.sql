-- Run this SQL in your Supabase SQL Editor to create the team_description table

-- Create team_description table
CREATE TABLE IF NOT EXISTS team_description (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Enable Row Level Security
ALTER TABLE team_description ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access on team_description" ON team_description
  FOR SELECT USING (true);

-- Create policies for authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to insert team_description" ON team_description
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update team_description" ON team_description
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete team_description" ON team_description
  FOR DELETE TO authenticated USING (true);

-- Insert a default empty row if table is empty
INSERT INTO team_description (content, updated_by)
SELECT '', 'system'
WHERE NOT EXISTS (SELECT 1 FROM team_description LIMIT 1);

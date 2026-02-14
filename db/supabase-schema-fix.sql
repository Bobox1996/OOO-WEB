-- STEP 1: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access on projects" ON projects;
DROP POLICY IF EXISTS "Allow public read access on images" ON images;
DROP POLICY IF EXISTS "Allow authenticated users to insert projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to update projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to delete projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to insert images" ON images;
DROP POLICY IF EXISTS "Allow authenticated users to update images" ON images;
DROP POLICY IF EXISTS "Allow authenticated users to delete images" ON images;

-- STEP 2: Create tables if they don't exist
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create policies for PROJECTS table
-- Anyone can read projects
CREATE POLICY "Anyone can read projects" ON projects
  FOR SELECT
  USING (true);

-- Authenticated users can insert projects  
CREATE POLICY "Authenticated users can insert projects" ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update projects
CREATE POLICY "Authenticated users can update projects" ON projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete projects
CREATE POLICY "Authenticated users can delete projects" ON projects
  FOR DELETE
  TO authenticated
  USING (true);

-- STEP 5: Create policies for IMAGES table
-- Anyone can read images
CREATE POLICY "Anyone can read images" ON images
  FOR SELECT
  USING (true);

-- Authenticated users can insert images
CREATE POLICY "Authenticated users can insert images" ON images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update images
CREATE POLICY "Authenticated users can update images" ON images
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete images
CREATE POLICY "Authenticated users can delete images" ON images
  FOR DELETE
  TO authenticated
  USING (true);

-- STEP 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);

-- Run this SQL in your Supabase SQL Editor to create the vision_content table

-- Create vision_content table
CREATE TABLE IF NOT EXISTS vision_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Enable Row Level Security
ALTER TABLE vision_content ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access on vision_content" ON vision_content
  FOR SELECT USING (true);

-- Create policies for authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated users to insert vision_content" ON vision_content
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update vision_content" ON vision_content
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete vision_content" ON vision_content
  FOR DELETE TO authenticated USING (true);

-- Insert a default empty row if table is empty
INSERT INTO vision_content (content, updated_by)
SELECT '', 'system'
WHERE NOT EXISTS (SELECT 1 FROM vision_content LIMIT 1);

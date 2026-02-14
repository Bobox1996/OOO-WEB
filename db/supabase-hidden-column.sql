-- Add hidden column to projects table for hiding projects from public view
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE projects ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_projects_hidden ON projects(hidden);

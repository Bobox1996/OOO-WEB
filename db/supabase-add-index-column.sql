-- Add 'index' column to projects table
-- Run this SQL in your Supabase SQL Editor to add the index field

ALTER TABLE projects ADD COLUMN IF NOT EXISTS index TEXT;

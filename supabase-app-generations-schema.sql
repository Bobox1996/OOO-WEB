-- Schema for AI Image Generator App
-- Run this in your Supabase SQL editor

-- Create table for storing generated images
CREATE TABLE app_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX idx_app_generations_user_id ON app_generations(user_id);
CREATE INDEX idx_app_generations_created_at ON app_generations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE app_generations ENABLE ROW LEVEL SECURITY;

-- Policy: users can only view their own generations
CREATE POLICY "Users can view own generations" ON app_generations
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: users can insert their own generations
CREATE POLICY "Users can insert own generations" ON app_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: users can delete their own generations
CREATE POLICY "Users can delete own generations" ON app_generations
  FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for generated images (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true);

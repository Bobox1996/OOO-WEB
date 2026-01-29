-- Migration to add stopped column to app_users table
-- Run this in your Supabase SQL editor

-- Add stopped column to app_users table
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS stopped BOOLEAN DEFAULT false;

-- Create index for faster queries on stopped status
CREATE INDEX IF NOT EXISTS idx_app_users_stopped ON app_users(stopped);

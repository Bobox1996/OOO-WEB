-- Schema for separate APP and ADMIN user authorization
-- Run this in your Supabase SQL editor

-- Create admin_users table - whitelist for admin access
-- role: 'super_admin' for full access, 'admin' for standard access
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create app_users table - whitelist for app access
CREATE TABLE IF NOT EXISTS app_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Policies for admin_users table
-- Only authenticated users who are admins can read/write admin_users
CREATE POLICY "Allow authenticated read on admin_users" ON admin_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on admin_users" ON admin_users
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on admin_users" ON admin_users
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on admin_users" ON admin_users
  FOR DELETE TO authenticated USING (true);

-- Policies for app_users table
-- Only authenticated users (admins) can manage app_users
CREATE POLICY "Allow authenticated read on app_users" ON app_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on app_users" ON app_users
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update on app_users" ON app_users
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete on app_users" ON app_users
  FOR DELETE TO authenticated USING (true);

-- IMPORTANT: After running this schema, manually add your first admin user:
-- INSERT INTO admin_users (email, role) VALUES ('your-admin@example.com', 'super_admin');

-- MIGRATION: If the admin_users table already exists without the role column, run:
-- ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
-- UPDATE admin_users SET role = 'super_admin' WHERE email ILIKE 'shimin@out-of-office.design';

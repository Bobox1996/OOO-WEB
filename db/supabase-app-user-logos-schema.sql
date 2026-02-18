-- User Logos table for storing user-uploaded logo PNGs
CREATE TABLE app_user_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_app_user_logos_user_id ON app_user_logos(user_id);

ALTER TABLE app_user_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logos" ON app_user_logos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logos" ON app_user_logos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logos" ON app_user_logos
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for user logos (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-logos', 'user-logos', true);

-- Storage policies for user-logos bucket
-- CREATE POLICY "Users can upload own logos" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'user-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own logos" ON storage.objects
--   FOR DELETE USING (bucket_id = 'user-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Public read for user logos" ON storage.objects
--   FOR SELECT USING (bucket_id = 'user-logos');

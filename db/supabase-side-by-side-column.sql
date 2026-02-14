-- Add side_by_side column to images table
-- This column controls whether an image should be displayed side-by-side with the next image
-- When two adjacent images both have side_by_side=true, they display in a row on desktop/tablet

ALTER TABLE images ADD COLUMN IF NOT EXISTS side_by_side BOOLEAN DEFAULT FALSE;

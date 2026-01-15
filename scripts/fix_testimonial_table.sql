-- Fix testimonial table schema mismatch
-- This script ensures all required fields exist in the testimonial table

-- Check if testimonial table exists, if not create it
-- Note: This assumes the table might be missing some columns

-- Add missing columns if they don't exist
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "sort" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "approved_by" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT NOW();

-- Ensure status column exists and has default
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';

-- Ensure quote column exists (required)
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "quote" TEXT NOT NULL DEFAULT '';

-- Ensure name column exists (required)
ALTER TABLE "testimonial" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';

-- Create indexes if they don't exist (these will fail silently if they exist)
CREATE INDEX IF NOT EXISTS "idx_testimonial_status" ON "testimonial" ("status");
CREATE INDEX IF NOT EXISTS "idx_testimonial_language" ON "testimonial" ("language");
CREATE INDEX IF NOT EXISTS "idx_testimonial_user_id" ON "testimonial" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_testimonial_language_status_sort" ON "testimonial" ("language", "status", "sort");

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'testimonial'
ORDER BY ordinal_position;

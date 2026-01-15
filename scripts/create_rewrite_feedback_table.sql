-- Create rewrite_feedback table for user feedback on AI rewrite feature
-- This table stores user ratings and comments for rewritten content

CREATE TABLE IF NOT EXISTS "rewrite_feedback" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "media_tasks"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL, -- 1-5 (1=thumbs down, 5=thumbs up)
  "comment" TEXT, -- Optional detailed feedback
  "style" TEXT, -- The rewrite style used (tiktok, youtube, etc.)
  "metadata" TEXT, -- JSON string for additional data (textLength, etc.)
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_rewrite_feedback_task" ON "rewrite_feedback"("task_id");
CREATE INDEX IF NOT EXISTS "idx_rewrite_feedback_user" ON "rewrite_feedback"("user_id");
CREATE INDEX IF NOT EXISTS "idx_rewrite_feedback_rating" ON "rewrite_feedback"("rating");

-- Add comment to table
COMMENT ON TABLE "rewrite_feedback" IS 'User feedback for AI rewrite feature';
COMMENT ON COLUMN "rewrite_feedback"."rating" IS 'Rating from 1-5 (1=thumbs down, 5=thumbs up)';
COMMENT ON COLUMN "rewrite_feedback"."comment" IS 'Optional detailed feedback text';
COMMENT ON COLUMN "rewrite_feedback"."style" IS 'The rewrite style used (tiktok, youtube, redbook, etc.)';
COMMENT ON COLUMN "rewrite_feedback"."metadata" IS 'JSON string for additional data like textLength';

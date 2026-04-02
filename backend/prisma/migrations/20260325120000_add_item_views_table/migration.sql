-- Migration to add item_views table for tracking user item browsing history
-- This table supports the personalized recommendation engine
-- All data is preserved, this is a safe additive migration

-- Create item_views table
CREATE TABLE IF NOT EXISTS "item_views" (
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 1,
    "last_viewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_views_pkey" PRIMARY KEY ("user_id", "item_id")
);

-- Foreign key constraints
ALTER TABLE "item_views"
ADD CONSTRAINT "item_views_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") 
ON DELETE CASCADE
ON UPDATE NO ACTION;

ALTER TABLE "item_views"
ADD CONSTRAINT "item_views_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "items"("id") 
ON DELETE CASCADE
ON UPDATE NO ACTION;

-- Indexes for efficient recommendation queries
CREATE INDEX IF NOT EXISTS "item_views_user_id_last_viewed_at_idx" 
ON "item_views"("user_id", "last_viewed_at" DESC);

CREATE INDEX IF NOT EXISTS "item_views_item_id_idx" 
ON "item_views"("item_id");

-- Index for finding recent views by user
CREATE INDEX IF NOT EXISTS "item_views_user_id_created_at_idx"
ON "item_views"("user_id", "created_at" DESC);

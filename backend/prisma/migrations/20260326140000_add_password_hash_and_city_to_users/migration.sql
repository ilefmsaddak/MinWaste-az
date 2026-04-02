-- Step 1: Add password_hash column (nullable by default, no default value)
-- Using IF NOT EXISTS for idempotency in case table state is inconsistent
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- Step 2: Add city column (nullable by default, no default value)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" VARCHAR(100);

-- Step 3: Index on city for efficient queries (safe if already exists)
CREATE INDEX IF NOT EXISTS "idx_users_city" ON "users"("city");


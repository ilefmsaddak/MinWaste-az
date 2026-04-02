
ALTER TABLE "public"."users" OWNER TO minwaste_user;

-- Step 2: Grant all privileges on the users table to minwaste_user
GRANT ALL PRIVILEGES ON TABLE "public"."users" TO minwaste_user;

-- Step 3: Also grant on related sequences/indexes that Prisma creates
-- This covers id, created_at, updated_at, and other default columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO minwaste_user;
GRANT CREATE ON SCHEMA public TO minwaste_user;

-- Step 4: Now apply the pending migrations
-- This should be run via: npx prisma migrate deploy
-- After running this privilege fix script

COMMIT;

-- Nécessaire pour les @default(dbgenerated("uuid_generate_v4()")) du schéma Prisma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fix ownership and permissions for migrations
-- Allow minwaste_user to ALTER existing tables created by postgres
DO $$
DECLARE
  table_record RECORD;
BEGIN
  -- Change ownership of all tables to minwaste_user
  FOR table_record IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public."%I" OWNER TO minwaste_user', table_record.table_name);
  END LOOP;
END
$$;

-- Grant all privileges on all tables to minwaste_user for future migrations
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO minwaste_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO minwaste_user;
GRANT CREATE ON SCHEMA public TO minwaste_user;

-- Ensure minwaste_user can create indented
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO minwaste_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO minwaste_user;

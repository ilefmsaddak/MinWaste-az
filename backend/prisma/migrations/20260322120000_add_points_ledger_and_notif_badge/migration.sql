-- CreateTable points_ledger (journal gamification)
CREATE TABLE IF NOT EXISTS "points_ledger" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "action_code" VARCHAR(64) NOT NULL,
    "ref_type" VARCHAR(32),
    "ref_id" UUID,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes (alignés sur schema.prisma)
CREATE UNIQUE INDEX IF NOT EXISTS "points_ledger_idempotency_key_key" ON "points_ledger"("idempotency_key");

CREATE INDEX IF NOT EXISTS "idx_points_ledger_user_date" ON "points_ledger"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_points_ledger_action" ON "points_ledger"("action_code");

-- FK vers users (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'points_ledger_user_id_fkey'
  ) THEN
    ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

-- Valeur enum pour notifications « badge obtenu » (si absente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notif_type' AND e.enumlabel = 'BADGE_EARNED'
  ) THEN
    ALTER TYPE "notif_type" ADD VALUE 'BADGE_EARNED';
  END IF;
END $$;

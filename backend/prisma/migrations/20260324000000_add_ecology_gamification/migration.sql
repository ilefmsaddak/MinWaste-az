-- Migration sûre pour ajouter les tables d'écologie et gamification
-- Cette migration préserve toutes les données existantes

-- Table des facteurs d'impact écologique par catégorie
CREATE TABLE IF NOT EXISTS "ecology_factors" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category" TEXT NOT NULL,
    "default_weight_kg" DECIMAL(8,3) NOT NULL,
    "co2_factor_kg_per_kg" DECIMAL(8,3) NOT NULL,
    "water_factor_l_per_kg" DECIMAL(8,3) NOT NULL,
    "energy_factor_kwh_per_kg" DECIMAL(8,3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ecology_factors_pkey" PRIMARY KEY ("id")
);

-- Index unique sur category
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_factors_category_key" ON "ecology_factors"("category");

-- Table des impacts écologiques par transaction finalisée
CREATE TABLE IF NOT EXISTS "transaction_impacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "transaction_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "effective_weight_kg" DECIMAL(10,3) NOT NULL,
    "food_saved_kg" DECIMAL(10,3) NOT NULL,
    "co2_saved_kg" DECIMAL(10,3) NOT NULL,
    "water_saved_liters" DECIMAL(12,3) NOT NULL,
    "energy_saved_kwh" DECIMAL(10,3) NOT NULL,
    "landfill_diversion_kg" DECIMAL(10,3) NOT NULL,
    "tree_equivalent" DECIMAL(8,2) NOT NULL,
    "neighborhood" TEXT,
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_impacts_pkey" PRIMARY KEY ("id")
);

-- Index unique sur transaction_id
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_impacts_transaction_id_key" ON "transaction_impacts"("transaction_id");

-- Index pour les requêtes de performance
CREATE INDEX IF NOT EXISTS "transaction_impacts_owner_id_completed_at_idx" ON "transaction_impacts"("owner_id", "completed_at");
CREATE INDEX IF NOT EXISTS "transaction_impacts_receiver_id_completed_at_idx" ON "transaction_impacts"("receiver_id", "completed_at");
CREATE INDEX IF NOT EXISTS "transaction_impacts_category_idx" ON "transaction_impacts"("category");
CREATE INDEX IF NOT EXISTS "transaction_impacts_completed_at_idx" ON "transaction_impacts"("completed_at");

-- Table des rapports mensuels
CREATE TABLE IF NOT EXISTS "monthly_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "month" SMALLINT NOT NULL,
    "year" INTEGER NOT NULL,
    "total_co2_saved_kg" DECIMAL(12,3) NOT NULL,
    "total_food_saved_kg" DECIMAL(12,3) NOT NULL,
    "total_water_saved_l" DECIMAL(15,3) NOT NULL,
    "total_energy_saved_kwh" DECIMAL(12,3) NOT NULL,
    "total_waste_reduced_kg" DECIMAL(12,3) NOT NULL,
    "tree_equivalent" DECIMAL(10,2) NOT NULL,
    "top_category" TEXT,
    "top_neighborhood" TEXT,
    "recommendations" JSONB,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id")
);

-- Index unique sur month/year
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_reports_month_year_key" ON "monthly_reports"("month", "year");
CREATE INDEX IF NOT EXISTS "monthly_reports_year_month_idx" ON "monthly_reports"("year", "month");

-- Insérer les facteurs d'impact par défaut (seulement s'ils n'existent pas)
INSERT INTO "ecology_factors" ("category", "default_weight_kg", "co2_factor_kg_per_kg", "water_factor_l_per_kg", "energy_factor_kwh_per_kg")
VALUES 
  ('FOOD', 1.0, 2.5, 50, 0.5),
  ('CLOTHES', 0.6, 15, 8000, 12),
  ('ELECTRONICS', 2.0, 25, 200, 35),
  ('FURNITURE', 10.0, 8, 120, 10),
  ('BOOKS', 0.5, 3, 25, 1.5),
  ('OTHER', 1.0, 5, 100, 2)
ON CONFLICT ("category") DO NOTHING;
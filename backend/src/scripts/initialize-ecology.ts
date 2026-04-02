import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initializeEcologyTables() {
  console.log('🌱 Initializing ecology and gamification tables...');

  try {
    // Create ecology_factors table
    await prisma.$executeRaw`
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
      )
    `;

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "ecology_factors_category_key" ON "ecology_factors"("category")
    `;

    // Create transaction_impacts table
    await prisma.$executeRaw`
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
      )
    `;

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "transaction_impacts_transaction_id_key" ON "transaction_impacts"("transaction_id")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "transaction_impacts_owner_id_completed_at_idx" ON "transaction_impacts"("owner_id", "completed_at")
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "transaction_impacts_receiver_id_completed_at_idx" ON "transaction_impacts"("receiver_id", "completed_at")
    `;

    // Create monthly_reports table
    await prisma.$executeRaw`
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
      )
    `;

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "monthly_reports_month_year_key" ON "monthly_reports"("month", "year")
    `;

    console.log('✅ Tables created successfully');

    // Insert default ecology factors
    const factors = [
      { category: 'FOOD', weight: 1.0, co2: 2.5, water: 50, energy: 0.5 },
      { category: 'CLOTHES', weight: 0.6, co2: 15, water: 8000, energy: 12 },
      { category: 'ELECTRONICS', weight: 2.0, co2: 25, water: 200, energy: 35 },
      { category: 'FURNITURE', weight: 10.0, co2: 8, water: 120, energy: 10 },
      { category: 'BOOKS', weight: 0.5, co2: 3, water: 25, energy: 1.5 },
      { category: 'OTHER', weight: 1.0, co2: 5, water: 100, energy: 2 },
    ];

    for (const factor of factors) {
      await prisma.$executeRaw`
        INSERT INTO "ecology_factors" ("category", "default_weight_kg", "co2_factor_kg_per_kg", "water_factor_l_per_kg", "energy_factor_kwh_per_kg")
        VALUES (${factor.category}, ${factor.weight}, ${factor.co2}, ${factor.water}, ${factor.energy})
        ON CONFLICT ("category") DO NOTHING
      `;
    }

    console.log('✅ Default ecology factors inserted');

    // Initialize default badges
    const badges = [
      { code: 'DONATEUR_NOVICE', name: 'Donateur Novice', description: 'Complete 5 donations as donor' },
      { code: 'SUPER_DONATEUR', name: 'Super Donateur', description: 'Complete 20 donations as donor' },
      { code: 'VENDEUR_SOLIDAIRE', name: 'Vendeur Solidaire', description: 'Complete 10 sales as seller' },
      { code: 'CIVIC_HERO', name: 'Civic Hero', description: 'Reach 50 total points' },
      { code: 'QUARTIER_PROPRE', name: 'Quartier Propre', description: 'Save 50 kg of food in your neighborhood' },
      { code: 'ECO_CITOYEN', name: 'Éco-Citoyen', description: 'Avoid 100 kg of CO2 emissions' },
    ];

    for (const badge of badges) {
      await prisma.badges.upsert({
        where: { code: badge.code },
        update: {},
        create: {
          code: badge.code,
          name: badge.name,
          description: badge.description,
          criteria: { type: 'points', threshold: 50 }, // Default criteria
        },
      });
    }

    console.log('✅ Default badges initialized');
    console.log('🎉 Ecology and gamification system ready!');

  } catch (error) {
    console.error('❌ Error initializing ecology tables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializeEcologyTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initializeEcologyTables };
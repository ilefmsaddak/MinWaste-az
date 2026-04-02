import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const badges = [
    {
      code: 'FIRST_STEPS',
      name: 'First Steps',
      description: 'Complete 1 transaction.',
      criteria: { type: 'COMPLETED_TRANSACTIONS_TOTAL', min: 1 },
    },
    {
      code: 'HELPER_5',
      name: 'Helper',
      description: 'Complete 5 transactions.',
      criteria: { type: 'COMPLETED_TRANSACTIONS_TOTAL', min: 5 },
    },
    {
      code: 'DONATEUR_NOVICE',
      name: 'Novice Donor',
      description: '5 donations completed as donor.',
      criteria: { type: 'COMPLETED_DONATIONS_AS_OWNER', min: 5 },
    },
    {
      code: 'SUPER_DONATEUR',
      name: 'Super Donor',
      description: '20 donations completed as donor.',
      criteria: { type: 'COMPLETED_DONATIONS_AS_OWNER', min: 20 },
    },
    {
      code: 'VENDEUR_SOLIDAIRE',
      name: 'Solidarity Seller',
      description: '10 paid sales completed.',
      criteria: { type: 'COMPLETED_SALES_AS_OWNER', min: 10 },
    },
    {
      code: 'CIVIC_HERO',
      name: 'Civic Hero',
      description: '50 points accumulated.',
      criteria: { type: 'POINTS_TOTAL', min: 50 },
    },
    {
      code: 'QUARTIER_PROPRE',
      name: 'Clean Neighborhood',
      description: '50 kg of food rescued in your neighborhood (city set in profile).',
      criteria: { type: 'DISTRICT_FOOD_KG', min: 50 },
    },
    {
      code: 'ECO_CITOYEN',
      name: 'Eco-Citizen',
      description: '100 kg CO₂ equivalent avoided (completed transactions).',
      criteria: { type: 'CO2_KG_AVOIDED_TOTAL', min: 100 },
    },
  ];

  for (const b of badges) {
    await prisma.badges.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description,
        criteria: b.criteria as any,
      },
      create: {
        code: b.code,
        name: b.name,
        description: b.description,
        criteria: b.criteria as any,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

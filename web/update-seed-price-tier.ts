import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from './src/lib/prisma';

async function update() {
  const perfumes = await prisma.perfume.findMany({ take: 3 });
  if (perfumes.length === 0) {
    console.error("No perfumes found");
    return;
  }

  const tiers = ['ARABIC', 'DESIGNER', 'NICHE'];
  for (let i = 0; i < perfumes.length; i++) {
    await prisma.perfume.update({
      where: { id: perfumes[i].id },
      data: { priceTier: tiers[i % tiers.length] as any }
    });
    console.log(`Updated perfume ${perfumes[i].id} to ${tiers[i % tiers.length]}`);
  }
}

update().catch(console.error).finally(() => prisma.$disconnect());

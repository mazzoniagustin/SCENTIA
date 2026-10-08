import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { ACCORD_TRANSLATIONS } from './accord-translations';

const adapter = new PrismaPg(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

const GENDER_MAP: Record<string, string> = {
  // Valores reales de fra_cleaned.csv: women (11376), men (4989), unisex (7698)
  'women': 'femenino',
  'men': 'masculino',
  'unisex': 'unisex'
};

async function run() {
  const filePath = path.resolve('data/fra_cleaned.csv');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parse(fileContent, { delimiter: ';', columns: true, skip_empty_lines: true });

  let imported = 0;
  let genderFallbackCount = 0;
  let samplePerfumeId: string | null = null;

  // Limitar a las primeras 50 filas
  const limit = Math.min(records.length, 50);

  for (let i = 0; i < limit; i++) {
    const row = records[i];
    if (!row.Brand || !row.Perfume) continue;

    const brand = row.Brand.trim();
    const name = row.Perfume.trim();

    // Género
    const genderRaw = row.Gender.toLowerCase().trim();
    const gender = GENDER_MAP[genderRaw];
    if (!gender) genderFallbackCount++;

    const perfume = await prisma.perfume.upsert({
      where: { brand_name: { brand, name } },
      create: {
        brand,
        name,
        gender: gender || 'unisex',
        concentration: 'unknown',
        releaseYear: row.Year ? parseInt(row.Year) : null,
        perfumer: [row.Perfumer1, row.Perfumer2].filter(Boolean).join(', '),
      },
      update: {},
    });

    if (i === 0) samplePerfumeId = perfume.id;

    // Notas (sin traducción)
    await prisma.perfumeNote.deleteMany({ where: { perfumeId: perfume.id } });
    const notes = [
      ...(row.Top || '').split(',').map((n: string) => ({ name: n.trim(), type: 'top' })),
      ...(row.Middle || '').split(',').map((n: string) => ({ name: n.trim(), type: 'heart' })),
      ...(row.Base || '').split(',').map((n: string) => ({ name: n.trim(), type: 'base' })),
    ];
    console.log(`Perfume ${name}: ${notes.length} notas detectadas`);

    for (const noteData of notes) {
      if (!noteData.name) continue;
      const note = await prisma.note.upsert({
        where: { name: noteData.name.toLowerCase() },
        create: { name: noteData.name.toLowerCase(), category: noteData.type },
        update: {},
      });
      await prisma.perfumeNote.create({
        data: { perfumeId: perfume.id, noteId: note.id, noteType: noteData.type },
      });
    }

    // Acordes (con traducción)
    await prisma.perfumeAccord.deleteMany({ where: { perfumeId: perfume.id } });
    console.log(`Perfume ${name}: Procesando acordes`);
    for (let j = 1; j <= 5; j++) {
      const engName = row[`mainaccord${j}`];
      if (engName && engName.trim()) {
        const cleanEng = engName.trim();
        const spaName = ACCORD_TRANSLATIONS[cleanEng] || cleanEng;
        console.log(` - Accord ${j}: ${engName} -> ${spaName}`);

        const accord = await prisma.accord.upsert({
          where: { name: spaName },
          create: { name: spaName },
          update: {},
        });

        await prisma.perfumeAccord.create({
          data: { perfumeId: perfume.id, accordId: accord.id, intensity: 100 - (j - 1) * 20 },
        });
      }
    }
    imported++;
  }

  console.log(`Importados: ${imported}`);
  console.log(`Fallback género: ${genderFallbackCount}`);

  if (samplePerfumeId) {
    const sample = await prisma.perfume.findUnique({
      where: { id: samplePerfumeId },
      include: { notes: { include: { note: true } }, accords: { include: { accord: true } } }
    });
// console.log('Muestra:', JSON.stringify(sample, null, 2));
console.log('Muestra: Perfume ID', sample?.id, 'Notas count:', sample?.notes.length, 'Accords count:', sample?.accords.length);
  }
}

run().catch(console.error);

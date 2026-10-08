import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const prisma = new PrismaClient();

const INTENSITY_MAP = [100, 80, 60, 40, 20];

async function getOrCreateNote(name: string, type: string) {
  const normalized = name.toLowerCase().trim();
  return await prisma.note.upsert({
    where: { name: normalized },
    create: { name: normalized, category: type },
    update: {},
  });
}

async function getOrCreateAccord(name: string) {
  const normalized = name.toLowerCase().trim();
  return await prisma.accord.upsert({
    where: { name: normalized },
    create: { name: normalized },
    update: {},
  });
}

async function run() {
  const fileContent = fs.readFileSync(path.resolve(process.cwd(), 'data/fra_cleaned.csv'), 'utf8');
  const records = parse(fileContent, { delimiter: ';', columns: true, skip_empty_lines: true });

  let imported = 0;
  let skipped = 0;

  for (const [index, row] of records.entries()) {
    if (!row.Brand || !row.Perfume) {
      skipped++;
      continue;
    }

    const perfume = await prisma.perfume.upsert({
      where: { brand_name: { brand: row.Brand.trim(), name: row.Perfume.trim() } },
      create: {
        brand: row.Brand.trim(),
        name: row.Perfume.trim(),
        gender: row.Gender,
        concentration: 'EDP', // Default
        releaseYear: row.Year ? parseInt(row.Year) : null,
        perfumer: row.Perfumer1,
        priceTier: null,
      },
      update: {
        gender: row.Gender,
        releaseYear: row.Year ? parseInt(row.Year) : null,
        perfumer: row.Perfumer1,
      },
    });

    // Notes
    await prisma.perfumeNote.deleteMany({ where: { perfumeId: perfume.id } });
    const notes = [
      ...row.Top.split(',').map((n: string) => ({ name: n, type: 'top' })),
      ...row.Middle.split(',').map((n: string) => ({ name: n, type: 'heart' })),
      ...row.Base.split(',').map((n: string) => ({ name: n, type: 'base' })),
    ];
    for (const noteData of notes) {
      if (!noteData.name.trim()) continue;
      const note = await getOrCreateNote(noteData.name, noteData.type);
      await prisma.perfumeNote.create({
        data: { perfumeId: perfume.id, noteId: note.id, noteType: noteData.type }
      });
    }

    // Accords
    await prisma.perfumeAccord.deleteMany({ where: { perfumeId: perfume.id } });
    for (let i = 0; i < 5; i++) {
      const accordName = row[`mainaccord${i + 1}`];
      if (accordName) {
        const accord = await getOrCreateAccord(accordName);
        await prisma.perfumeAccord.create({
          data: { perfumeId: perfume.id, accordId: accord.id, intensity: INTENSITY_MAP[i] }
        });
      }
    }

    imported++;
    if (imported % 500 === 0) console.log(`Importadas ${imported} filas...`);
  }
  console.log(`Finalizado. Importados: ${imported}, Salteados: ${skipped}`);
}

run();

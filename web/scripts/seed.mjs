// Seed de desarrollo para probar el catálogo (RF-01). Ejecutar desde web/:
//   node scripts/seed.mjs
// Es idempotente respecto a datos previos: borra perfume/nota/acorde antes de insertar.

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

const adapter = new PrismaPg(process.env.DATABASE_URL)
const prisma = new PrismaClient({ adapter })

const perfumes = [
  { id: 'p1', brand: 'Dior', name: 'Sauvage', gender: 'masculino', concentration: 'edp', releaseYear: 2015, perfumer: 'François Demachy', description: 'Aromático fresco con fondo ambarado.', duration: 10, projection: 3, seasons: ['primavera', 'verano', 'otoño'], occasions: ['diario', 'trabajo', 'deporte'] },
  { id: 'p2', brand: 'Chanel', name: 'Bleu de Chanel', gender: 'masculino', concentration: 'parfum', releaseYear: 2018, perfumer: 'Olivier Polge', description: 'Amaderado aromático elegante.', duration: 8, projection: 3, seasons: ['otoño', 'invierno'], occasions: ['trabajo', 'formal', 'noche'] },
  { id: 'p3', brand: 'Dior', name: 'Hypnôse', gender: 'femenino', concentration: 'edp', releaseYear: 2005, perfumer: 'Thierry Wasser', description: 'Floral oriental envolvente.', duration: 6, projection: 2, seasons: ['otoño', 'invierno'], occasions: ['cita', 'noche'] },
  { id: 'p4', brand: 'Maison Margiela', name: 'Replica Jazz Club', gender: 'unisex', concentration: 'edt', releaseYear: 2013, perfumer: 'Thomas Fontaine', description: 'Tabaco, ron y vainilla de bar de jazz.', duration: 6, projection: 2, seasons: ['otoño', 'invierno'], occasions: ['noche', 'formal'] },
  { id: 'p5', brand: 'Chanel', name: 'Chance Eau Tendre', gender: 'femenino', concentration: 'edt', releaseYear: 2010, perfumer: 'Olivier Polge', description: 'Floral afrutado luminoso.', duration: 4, projection: 2, seasons: ['primavera', 'verano'], occasions: ['diario', 'deporte'] },
]

const notes = [
  ['n1', 'bergamota', 'citrico'], ['n2', 'pimienta rosa', 'especiada'], ['n3', 'vainilla', 'gourmand'],
  ['n4', 'ámbar', 'oriental'], ['n5', 'parchís', 'frutal'], ['n6', 'jazmín', 'floral'],
  ['n7', 'sándalo', 'amaderado'], ['n8', 'lavanda', 'aromático'],
]
const accords = [
  ['a1', 'cítrico'], ['a2', 'dulce'], ['a3', 'floral'], ['a4', 'especiado'], ['a5', 'amaderado'],
]

const perfumeNotes = [
  ['p1', 'n1', 'top'], ['p1', 'n8', 'heart'], ['p1', 'n7', 'base'], ['p1', 'n4', 'base'],
  ['p2', 'n8', 'top'], ['p2', 'n7', 'heart'], ['p2', 'n4', 'base'],
  ['p3', 'n5', 'top'], ['p3', 'n6', 'heart'], ['p3', 'n3', 'base'],
  ['p4', 'n2', 'top'], ['p4', 'n3', 'heart'], ['p4', 'n4', 'base'],
  ['p5', 'n5', 'top'], ['p5', 'n6', 'heart'], ['p5', 'n1', 'base'],
]
const perfumeAccords = [
  ['p1', 'a1', 70], ['p1', 'a4', 60], ['p1', 'a5', 65],
  ['p2', 'a5', 80], ['p2', 'a4', 55],
  ['p3', 'a3', 75], ['p3', 'a2', 60],
  ['p4', 'a2', 85], ['p4', 'a4', 50],
  ['p5', 'a3', 70], ['p5', 'a1', 50],
]

async function main() {
  // Limpieza en orden respetando las FK (hijas primero)
  await prisma.perfumeNote.deleteMany({})
  await prisma.perfumeAccord.deleteMany({})
  await prisma.perfume.deleteMany({})
  await prisma.note.deleteMany({})
  await prisma.accord.deleteMany({})

  await prisma.note.createMany({ data: notes.map(([id, name, category]) => ({ id, name, category })) })
  await prisma.accord.createMany({ data: accords.map(([id, name]) => ({ id, name })) })
  await prisma.perfume.createMany({ data: perfumes })
  await prisma.perfumeNote.createMany({ data: perfumeNotes.map(([p, n, t]) => ({ perfumeId: p, noteId: n, noteType: t })) })
  await prisma.perfumeAccord.createMany({ data: perfumeAccords.map(([p, a, i]) => ({ perfumeId: p, accordId: a, intensity: i })) })

  console.log(`Seed OK: ${perfumes.length} perfumes, ${notes.length} notas, ${accords.length} acordes`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERR:', e.message)
  process.exit(1)
})

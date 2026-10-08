import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
console.log("DATABASE_URL cargada desde .env.local:", process.env.DATABASE_URL);

import { getOrCreateUser } from './auth';

async function runTests() {
  const { prisma } = await import('./prisma');
  console.log("--- Iniciando pruebas de getOrCreateUser ---");


  // Limpiar base de datos para pruebas
  await prisma.userCollection.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("DB limpia.");

  const email = "test@example.com";
  const supabaseId1 = "supa-1";
  const supabaseId2 = "supa-2";

  // CASO 1: Usuario nuevo (no existe ni por email ni por supabaseId)
  console.log("\nPrueba 1: Usuario nuevo...");
  const user1 = await getOrCreateUser({ user: { id: supabaseId1, email } });
  console.log("Usuario creado:", user1);
  if (user1.supabaseId !== supabaseId1) throw new Error("Fallo en creación usuario nuevo");

  // CASO 2: Usuario preexistente por email (se debe vincular)
  console.log("\nPrueba 2: Usuario existente por email (vincular)...");
  // Simular usuario existente sin supabaseId
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: { email, name: "Existente" } });
  const user2 = await getOrCreateUser({ user: { id: supabaseId2, email } });
  console.log("Usuario vinculado:", user2);
  if (user2.supabaseId !== supabaseId2) throw new Error("Fallo en vinculación por email");

  // CASO 3: Segunda llamada con mismo supabaseId (idempotencia)
  console.log("\nPrueba 3: Segunda llamada (idempotencia)...");
  const user3 = await getOrCreateUser({ user: { id: supabaseId2, email } });
  console.log("Usuario recuperado:", user3);
  if (user3.id !== user2.id) throw new Error("Fallo en idempotencia");

  console.log("\n--- Todas las pruebas pasaron satisfactoriamente ---");
}

runTests()
  .catch(console.error)
  .finally(async () => {
    const { prisma } = await import('./prisma');
    await prisma.$disconnect();
  });

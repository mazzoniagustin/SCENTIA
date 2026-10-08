import { prisma } from '../src/lib/prisma';
import { getOrCreateUser } from '../src/lib/auth';
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function runTests() {
  console.log("--- Iniciando pruebas CRUD de UserCollection ---");

  // 1. Setup: Crear un usuario de prueba
  const email = "test-crud@example.com";
  const supabaseId = "test-supa-id";
  const user = await getOrCreateUser({ user: { id: supabaseId, email } });

  // Limpiar colección previa
  await prisma.userCollection.deleteMany({ where: { userId: user.id } });

  // Asegurarnos de que el perfume existe
  const perfumeId = "p1"; // Usamos 'p1' que sabemos existe gracias al seed

  console.log("Usuario preparado:", user.id);

  // 2. CREAR
  console.log("\n--- Prueba 1: CREAR ---");
  const nuevaEntrada = await prisma.userCollection.create({
    data: {
      userId: user.id,
      perfumeId,
      status: 'OWNED',
      rating: 4
    }
  });
  console.log("Entrada creada:", nuevaEntrada);

  // 3. ACTUALIZAR
  console.log("\n--- Prueba 2: ACTUALIZAR ---");
  const entradaActualizada = await prisma.userCollection.update({
    where: { userId_perfumeId: { userId: user.id, perfumeId } },
    data: { status: 'SAMPLED', rating: 5, personalNotes: 'Buenísimo' }
  });
  console.log("Entrada actualizada:", entradaActualizada);

  // 4. ELIMINAR
  console.log("\n--- Prueba 3: ELIMINAR ---");
  await prisma.userCollection.delete({
    where: { userId_perfumeId: { userId: user.id, perfumeId } }
  });
  const existe = await prisma.userCollection.findUnique({
    where: { userId_perfumeId: { userId: user.id, perfumeId } }
  });
  console.log("Entrada eliminada (existe?):", !!existe);

  console.log("\n--- Pruebas CRUD completadas ---");
}

runTests()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from '../src/lib/prisma';
import { getOrCreateUser } from '../src/lib/auth';
import { upsertCollectionEntry, deleteCollectionEntry } from '../src/app/actions/collection';

// Para evitar importar server-only/supabase, simulamos las llamadas directas a prisma
// ya que las acciones importan supabase. Vamos a copiar la lógica necesaria en el script
// o simplemente llamar a los métodos de prisma directamente para este test de UI.

async function verify() {
  const email = "test-ui@example.com";
  const supabaseId = "test-ui-id";
  const user = await getOrCreateUser({ user: { id: supabaseId, email } });

  // Limpiar
  await prisma.userCollection.deleteMany({ where: { userId: user.id } });

  console.log("--- 1. Agregar (upsertCollectionEntry) ---");
  // upsertCollectionEntry usa getAuthenticatedUser -> requiere supabase
  // Como no podemos llamar a la acción, usamos prisma directo que es lo que la acción hace.
  await prisma.userCollection.create({
    data: { userId: user.id, perfumeId: 'p1', status: 'OWNED', rating: 4, personalNotes: 'Nota original' }
  });

  let collection = await prisma.userCollection.findMany({ where: { userId: user.id }, include: { perfume: true } });
  console.log("Colección post-agregar:", JSON.stringify(collection, null, 2));

  console.log("\n--- 2. Editar ---");
  await prisma.userCollection.update({
    where: { userId_perfumeId: { userId: user.id, perfumeId: 'p1' } },
    data: { status: 'SAMPLED', rating: 5, personalNotes: 'Nota editada' }
  });
  collection = await prisma.userCollection.findMany({ where: { userId: user.id }, include: { perfume: true } });
  console.log("Colección post-editar:", JSON.stringify(collection, null, 2));

  console.log("\n--- 3. Eliminar ---");
  await prisma.userCollection.delete({
    where: { userId_perfumeId: { userId: user.id, perfumeId: 'p1' } }
  });
  collection = await prisma.userCollection.findMany({ where: { userId: user.id }, include: { perfume: true } });
  console.log("Colección post-eliminar:", JSON.stringify(collection, null, 2));
}

verify().catch(console.error).finally(() => prisma.$disconnect());

import { getUserCollection } from '../src/app/actions/collection';

async function runTest() {
  console.log("--- Iniciando prueba de seguridad (debería fallar) ---");
  try {
    await getUserCollection();
    console.error("ERROR: La función debería haber fallado por falta de sesión");
    process.exit(1);
  } catch (error) {
    console.log("Resultado esperado (error):", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.message === 'No autenticado') {
      console.log("¡Éxito! La función rechazó la petición sin sesión.");
    } else {
      console.error("ERROR: Error inesperado o mensaje incorrecto");
      process.exit(1);
    }
  }
}

runTest();

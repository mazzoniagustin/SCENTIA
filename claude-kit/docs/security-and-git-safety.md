# Seguridad y Git-safety

## Acciones que requieren confirmación explícita

No eliminar ni sobrescribir archivos, hacer commits, ejecutar `git push --force`, reescribir historia, eliminar branches, modificar `.env`, secretos o CI/CD, instalar dependencias o frameworks, ejecutar migraciones destructivas ni realizar acciones con riesgo significativo de pérdida de datos sin confirmación explícita del usuario.

Los commits, pushes y merges se realizan solo con confirmación explícita del usuario, para la acción o el lote concreto (ver `AGENTS.md` raíz). `test.txt` está protegido y no puede eliminarse, sobrescribirse, moverse ni modificarse salvo instrucción explícita del usuario.

## Prácticas obligatorias

- Inspeccionar el alcance y los archivos afectados antes de acciones potencialmente destructivas.
- Preferir operaciones reversibles y planes de reversión verificables.
- Mantener secretos fuera del repositorio, la salida de herramientas y la documentación.
- Validar migraciones con copia de seguridad, estrategia de reversión y autorización antes de ejecutarlas.
- Informar riesgos, supuestos y evidencia antes de solicitar una confirmación.

## Git

Flujo sugerido (ajustalo al proyecto). El trabajo se hace en ramas `feat/…` o `fix/…` que salen de `development` (rama de integración); `development` pasa a `main` solo cuando el usuario lo pide, y eliminar ramas requiere confirmación. Revisar `git status` y el diff antes de preparar cambios. Mantener commits pequeños, con asunto imperativo y alcance claro, por ejemplo: `Add validation script`. Una pull request debe explicar qué cambia, cómo se verificó, riesgos conocidos, issues relacionados y capturas cuando haya interfaz visible.

Estas pautas no autorizan operaciones Git: prevalecen siempre las reglas de confirmación del archivo raíz.

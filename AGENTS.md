# Repository Guidelines

## Alcance y precedencia

Estas reglas aplican a todo el repositorio. La prioridad es: seguridad y Git-safety; este archivo; `AGENTS.md` de la carpeta afectada; y, por último, la skill, rol o workflow aplicable.

Una regla de prioridad menor no puede habilitar una acción prohibida por una regla superior. Las excepciones locales deben declararse en `AGENTS.override.md` y respetar esa precedencia.

## Seguridad y cambios

- Pedí confirmación explícita antes de eliminar o sobrescribir archivos, hacer commits, `git push --force`, reescribir historial, eliminar branches, modificar `.env`, secretos o CI/CD, instalar dependencias, ejecutar migraciones destructivas o realizar acciones con riesgo significativo de pérdida de datos.
- Los commits, pushes y merges se hacen solo con confirmación explícita de la persona, para la acción o el lote concreto (por ejemplo: "commiteá y mergeá a `development`"). No los hagas por iniciativa propia. `development` es la rama de integración y `main` solo se actualiza cuando la persona lo pide.
- `test.txt` está protegido: no lo elimines, sobrescribas, muevas ni modifiques salvo instrucción explícita del usuario.
- No incluyas credenciales, tokens ni configuraciones locales en archivos versionables.

## Convenciones generales

- Todo texto explicativo en `AGENTS.md` y `docs/` se escribe en español; los nombres de archivos, carpetas, variables, funciones, comandos e identificadores permanecen en inglés.
- Usá nombres descriptivos en minúsculas; preferí kebab-case cuando la convención del lenguaje no indique otra cosa. Conservá UTF-8 y salto de línea final.
- La infraestructura documental (`.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `docs/`) es agnóstica de framework. La aplicación vive en `web/` (Next.js, Prisma y Supabase; ver `web/AGENTS.md` y `web/PROGRESS.md`): dentro de ella rigen sus reglas y comandos. No instales herramientas ni dependencias, en el repositorio o fuera de él, sin confirmación.

## Navegación

Consultá [docs/README.md](docs/README.md) para operar esta infraestructura; [docs/security-and-git-safety.md](docs/security-and-git-safety.md) para la política detallada; [docs/claude-structure-rules.md](docs/claude-structure-rules.md) antes de trabajar dentro de `.claude/skills/`, `.claude/agents/` o `.claude/commands/`; y las reglas anidadas de `scripts/`.

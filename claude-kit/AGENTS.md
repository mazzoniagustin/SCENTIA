# Repository Guidelines

## Alcance y precedencia

Estas reglas aplican a todo el repositorio. La prioridad es: seguridad y Git-safety; este archivo; `AGENTS.md` de la carpeta afectada; y, por último, la skill, rol o workflow aplicable.

Una regla de prioridad menor no puede habilitar una acción prohibida por una regla superior. Las excepciones locales deben declararse en `AGENTS.override.md` y respetar esa precedencia.

## Seguridad y cambios

- Pedí confirmación explícita antes de eliminar o sobrescribir archivos, hacer commits, `git push --force`, reescribir historial, eliminar branches, modificar `.env`, secretos o CI/CD, instalar dependencias, ejecutar migraciones destructivas o realizar acciones con riesgo significativo de pérdida de datos.
- Los commits, pushes y merges se hacen solo con confirmación explícita de la persona, para la acción o el lote concreto. No los hagas por iniciativa propia.
- No incluyas credenciales, tokens ni configuraciones locales en archivos versionables.

## Convenciones generales

- Todo texto explicativo en `AGENTS.md` y `docs/` se escribe en español; los nombres de archivos, carpetas, variables, funciones, comandos e identificadores permanecen en inglés.
- Usá nombres descriptivos en minúsculas; preferí kebab-case cuando la convención del lenguaje no indique otra cosa. Conservá UTF-8 y salto de línea final.
- La infraestructura documental (`.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `docs/`) es agnóstica de framework. No instales herramientas ni dependencias sin confirmación.

## Proyecto (completar al adoptar el kit)

<!-- Stack, comandos de build/test/lint, estructura de carpetas, archivos protegidos y rama de integración. -->

## Navegación

Consultá [docs/README.md](docs/README.md) para operar esta infraestructura; [docs/security-and-git-safety.md](docs/security-and-git-safety.md) para la política detallada; [docs/claude-structure-rules.md](docs/claude-structure-rules.md) antes de trabajar dentro de `.claude/skills/`, `.claude/agents/` o `.claude/commands/`; y las reglas anidadas de `scripts/`.

# Reglas de `.claude/agents`, `.claude/skills` y `.claude/commands`

Estas reglas reúnen lo que antes podía vivir en `agents/AGENTS.md`, `skills/AGENTS.md` y `workflows/AGENTS.md`. Claude Code interpreta como definición cada `.md` de `.claude/agents/` y `.claude/skills/`, así que no conviene dejar un `AGENTS.md` ahí.

## `.claude/agents/`

Los archivos son especificaciones de roles; Claude Code los ofrece como subagentes. Cada `.claude/agents/<role>.md` define objetivo, responsabilidades, entradas, entregables, límites y colaboración. Los nombres de roles se mantienen en inglés y el contenido explicativo en español. Un coordinador los usa como guía o como contexto al delegar, siempre sujeto a las reglas globales.

No dupliques políticas de seguridad: enlazá o remití a `AGENTS.md` raíz cuando aplique.

## `.claude/skills/`

Biblioteca operativa del repositorio. Cada skill vive en `.claude/skills/<skill-name>/SKILL.md`, usa nombres en inglés y explica en español su propósito, entradas, pasos, entregables y límites. Debe ser genérica, reutilizable y no depender de un framework ni de un dominio de negocio.

No agregues código ejecutable, dependencias ni secretos a esta carpeta. Si una tarea puede requerir cambios sensibles, la skill debe remitir a las reglas globales de confirmación. Actualizá el índice y las instrucciones de uso en `docs/` cuando se agregue una skill.

## `.claude/commands/` (workflows)

Los workflows (hoy `full-delivery`, invocable como comando) son guías de coordinación, no sustitutos de la decisión humana. Cada archivo usa el patrón `.claude/commands/<workflow-name>.md`, con etapas, entradas, actividades, entregables, gates y responsables sugeridos.

Deben ser genéricos, independientes de framework y compatibles con las reglas de seguridad del repositorio. Una etapa puede omitirse o iterarse solo cuando se documente su motivo y no se reduzca una garantía requerida por una regla superior.

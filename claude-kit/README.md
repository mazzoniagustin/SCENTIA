# claude-kit

Configuración reutilizable para Claude Code, agnóstica de lenguaje y framework. Se copia a la raíz de cualquier proyecto.

## Contenido

| Ruta | Qué es |
| --- | --- |
| `AGENTS.md` | Reglas del repositorio (precedencia, seguridad, convenciones). Tiene una sección para completar con el stack. |
| `CLAUDE.md` | Importa `AGENTS.md`. |
| `.claude/agents/` | Roles: architect, backend, database, frontend, planner, researcher, reviewer, security-auditor, tester. |
| `.claude/skills/` | project-discovery, requirements, architecture, database, testing-accessibility, security-review, web-design-guidelines. |
| `.claude/commands/` | Workflow `full-delivery`. |
| `docs/` | Operación de agentes, reglas de `.claude/`, seguridad y Git, testing y accesibilidad. |
| `scripts/AGENTS.md` | Reglas para scripts futuros. |

## Uso en otro proyecto

Desde la raíz del proyecto destino (`-n` no pisa archivos existentes):

```bash
cp -rn /ruta/a/claude-kit/. .
rm -f README.md   # el del kit; conservá el del proyecto si ya tenías uno
```

Después completá la sección «Proyecto» de `AGENTS.md` (stack, comandos, archivos protegidos, rama de integración).

## Qué quedó afuera a propósito

- Skill `database` original (dominio de perfumes + Prisma/Supabase): se dejó una versión genérica.
- `.claude/settings.local.json` (permisos propios de este proyecto), `web/AGENTS.md` y `PROGRESS.md`.
- `~/.claude/CLAUDE.md` y `RTK.md`: ya son globales y valen para todos los proyectos.
- `docs/project-specification.md` y `docs/superpowers/`: son del proyecto.

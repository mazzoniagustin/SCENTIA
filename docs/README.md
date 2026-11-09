# Documentación de la infraestructura

Este directorio explica cómo usar y mantener la infraestructura reutilizable del repositorio. No define un dominio de negocio ni impone un framework.

## Índice

- [Operación de agentes](agent-operations.md): descubrimiento de skills, roles, workflows y precedencia de reglas.
- [Reglas de `.claude/`](claude-structure-rules.md): reglas de agents, skills y commands (antes `AGENTS.md` anidados).
- [Testing y accesibilidad](testing-and-accessibility.md): principios y checklist para proyectos futuros.
- [Seguridad y Git-safety](security-and-git-safety.md): confirmaciones, protección de datos y operaciones Git.

## Uso recomendado

1. Empezar por las reglas aplicables en `AGENTS.md`.
2. Consultar una skill de `.claude/skills/` para el tipo de trabajo.
3. Usar un rol de `.claude/agents/` y un workflow de `.claude/commands/` como guías de responsabilidad y secuencia.
4. Registrar decisiones, evidencia y riesgos en la documentación del proyecto que se incorpore en el futuro.

Esta infraestructura es documental y operativa. Su contenido guía a personas y agentes; no configura automáticamente herramientas, subagentes, comandos ni integraciones.

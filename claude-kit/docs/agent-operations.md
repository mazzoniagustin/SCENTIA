# Operación de agentes, skills y workflows

## Precedencia

Aplicá las instrucciones en este orden: seguridad y Git-safety; `AGENTS.md` raíz; reglas de la carpeta afectada; y skill, rol o workflow específico. Las reglas de menor prioridad solo pueden restringir o aclarar, nunca permitir lo que una superior prohíbe. Usá `AGENTS.override.md` solo para excepciones locales compatibles con esa jerarquía.

## Biblioteca `.claude/skills/`

`.claude/skills/` es una biblioteca del repositorio que Claude Code puede descubrir como skills. Para usarla, identificá la necesidad, abrí `.claude/skills/<skill-name>/SKILL.md`, seguí su procedimiento y entregá la evidencia indicada. No supongas descubrimiento, carga ni ejecución automática; la selección de una skill es una decisión explícita del agente o de la persona que trabaja.

La biblioteca contiene `project-discovery`, `requirements`, `architecture`, `database`, `testing-accessibility`, `security-review` y `web-design-guidelines`. Toda nueva skill debe conservar el formato, ser agnóstica de dominio y actualizar las instrucciones de esta carpeta cuando cambie el método de descubrimiento.

## Roles en `.claude/agents/`

Los archivos de `.claude/agents/` son contratos de rol reutilizables. Definen qué investigar, producir y limitar; crear uno no crea un subagente ejecutable. Cuando el entorno ofrezca mecanismos nativos de colaboración o subagentes, un coordinador puede proporcionar el archivo de rol como contexto al delegar una tarea independiente. Esa integración depende de la capacidad disponible y no está configurada por este repositorio.

## Workflows en `.claude/commands/`

Los workflows ordenan el trabajo y sus gates; tampoco ejecutan pasos automáticamente. Elegí el workflow pertinente, adapta sus etapas al alcance y documentá cualquier omisión. Mantené la trazabilidad entre requisitos, arquitectura, implementación, pruebas, revisión de seguridad, revisión de código y despliegue.

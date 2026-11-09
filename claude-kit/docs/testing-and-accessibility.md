# Testing y accesibilidad

## Principios

La calidad se diseña desde los requisitos. Cada comportamiento relevante debe tener criterios de aceptación observables, escenarios de error y evidencia proporcional al riesgo. Las pruebas no sustituyen la revisión humana, y la revisión manual no sustituye escenarios reproducibles.

Esta infraestructura documental no depende de una herramienta. Antes de sumar un framework, runner, linter o servicio, definí el tipo de riesgo y la evidencia requerida; la instalación requiere confirmación. Registrá en el proyecto los comandos de prueba concretos (en su propio `AGENTS.md`).

## Checklist para proyectos futuros

- Relacionar cada requisito con escenarios positivos, negativos y de borde.
- Cubrir niveles unitario, integración y extremo a extremo cuando aporten valor.
- Definir datos de prueba seguros y reproducibles; no usar secretos ni datos personales reales sin autorización.
- Registrar entorno, comando, resultado y limitaciones de cada ejecución.
- Revisar regresiones antes de entregar cambios de comportamiento.

## Accesibilidad

- Usar estructura semántica y nombres accesibles para controles y contenido.
- Permitir navegación completa por teclado, con foco visible y orden lógico.
- Ofrecer contraste suficiente y no depender solo de color, posición, sonido o tiempo.
- Asociar etiquetas, instrucciones y errores comprensibles a cada campo.
- Proporcionar alternativas textuales y comunicar cambios dinámicos de forma accesible.
- Validar con revisiones manuales y herramientas apropiadas una vez definido el stack.

La meta es una experiencia usable por diversas personas y tecnologías de asistencia, no solo cumplir una lista mecánica.

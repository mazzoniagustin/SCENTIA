# Full Delivery Workflow

## Propósito

Guiar la entrega de un producto o cambio completo, con iteraciones controladas y evidencia en cada gate.

| Etapa | Actividad principal | Entregable / gate |
| --- | --- | --- |
| Idea | Definir problema, usuarios y resultado esperado. | Objetivo, alcance y exclusiones. |
| Research | Validar contexto, alternativas y restricciones. | Hallazgos con fuentes y riesgos. |
| Requirements | Establecer requisitos y aceptación. | Especificación priorizada. |
| Architecture | Diseñar componentes, contratos y decisiones. | Propuesta técnica aprobada. |
| Database Design | Modelar datos, integridad y evolución. | Modelo y plan de migración seguro. |
| UI/UX | Diseñar flujos, estados y accesibilidad. | Flujos y criterios de interacción. |
| Implementation | Construir cambios pequeños y trazables. | Cambios revisables. |
| Testing | Ejecutar escenarios y registrar evidencia. | Resultados y defectos resueltos o aceptados. |
| Security Review | Evaluar amenazas y controles. | Hallazgos mitigados o riesgo residual aceptado. |
| Code Review | Revisar corrección, calidad y documentación. | Aprobación o acciones pendientes. |
| Documentation | Actualizar operación, decisiones y uso. | Documentación coherente. |
| Deployment | Preparar liberación, reversión y observación. | Plan de despliegue autorizado. |

## Reglas de operación

Cada etapa consume los entregables validados de la anterior y puede devolver trabajo a una etapa previa. Los roles de `agents/` son sugerencias de responsabilidad, no automatizaciones. No avanzar ante decisiones críticas sin evidencia o confirmación explícita, especialmente para acciones protegidas por `AGENTS.md` raíz.

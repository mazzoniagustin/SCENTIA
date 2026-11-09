# Diseño y modelado de datos

## Propósito

Modelar datos consistentes, seguros y evolutivos a partir de requisitos confirmados, sin imponer un motor ni un ORM prematuro.

## Procedimiento

1. Identificar entidades, relaciones, cardinalidades y reglas de negocio a partir de los requisitos.
2. Definir claves, restricciones de integridad, índices según los patrones de consulta y política de retención.
3. Evaluar privacidad, datos personales, respaldo y recuperación.
4. Diseñar migraciones reversibles y un plan de validación; las destructivas requieren confirmación explícita.
5. Elegir motor y herramientas solo después de confirmar el stack del proyecto.

## Entregable

Un modelo documentado (entidades, relaciones, restricciones, índices) con plan de migración y riesgos. No ejecutar migraciones sin autorización.

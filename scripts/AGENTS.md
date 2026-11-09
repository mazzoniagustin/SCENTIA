# Reglas para `scripts/`

Esta carpeta queda reservada para scripts de automatización futuros. No agrega herramientas ni comandos ejecutables por sí sola.

Todo script debe usar un nombre descriptivo en inglés, documentar propósito, entradas, efectos, requisitos y ejemplo de uso. Debe fallar de forma clara, validar parámetros, evitar secretos en la salida y minimizar efectos secundarios.

No crear scripts que eliminen datos, modifiquen infraestructura, instalen dependencias, alteren CI/CD o reescriban Git sin una confirmación explícita para la acción concreta. Preferí modos de vista previa, operaciones idempotentes y rutas de reversión cuando sean aplicables.

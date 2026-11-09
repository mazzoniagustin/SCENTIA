# Documentación RF-03: Comparador de Perfumes

## Descripción
Esta funcionalidad permite a los usuarios seleccionar entre 2 y 4 perfumes del catálogo para visualizarlos comparativamente.

## Decisiones Técnicas
- **Visualización**: Se implementó un radar chart utilizando SVG puro (sin dependencias como Recharts) para garantizar control total sobre el diseño y la accesibilidad.
- **Geometría**: El radar Chart utiliza un sistema de coordenadas radiales basado en un centro común, con ejes determinados por la unión alfabética de acordes de todos los perfumes seleccionados (corte top-6 si supera 8).
- **Contrato API**: Se reutiliza el endpoint `GET /api/perfumes` añadiendo un parámetro de query `ids`.
  - Soporta 2-4 IDs.
  - Retorna `400` si el formato o número de IDs es incorrecto.
  - Si un ID no existe, la API retorna `200` incluyendo un campo `missing` en la respuesta (no se infieren datos).
  - El orden de los perfumes en `data` respeta el orden de los IDs en el parámetro.

## Accesibilidad (RF-03)
- **Radar Chart**: Marcado como `role="img"` con `aria-labelledby` referenciando `<title>` y `<desc>` para describir el contenido a tecnologías asistivas.
- **Navegación**: Los selectores son `<checkbox>` nativos con `aria-label` descriptivos (`Comparar [Nombre]`).
- **Eliminación**: Los botones de cierre tienen `aria-label` específicos y son operables mediante teclado.

## Estado de implementación
- **Completado**: Diseño, lógica de radar, API, componentes de selección (Checkbox/Bar) y eliminación *in-place*.
- **Acceso**: El comparador es accesible mediante teclado y lectores de pantalla.

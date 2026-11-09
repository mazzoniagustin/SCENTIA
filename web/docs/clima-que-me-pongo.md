# ¿Qué me pongo hoy?

Recomienda un perfume de **tu colección** (`OWNED` y `SAMPLED`; `DISLIKED` y `WISHLIST` quedan fuera) según el clima actual. Ruta: `/que-me-pongo` (requiere sesión).

## Cómo decide
- El ranking es **determinista**, sin IA: `src/lib/outfit/{profile,rules,score}.ts`. Usa temperatura aparente (frío < 15 °C, calor ≥ 25 °C), humedad alta desde 70 % y lluvia/nieve (precipitación ≥ 0,1 mm o código WMO de agua). Calor/humedad favorecen acordes frescos; frío, los cálidos; con lluvia o humedad se penalizan los empalagosos.
- Una frase opcional redactada por IA (`src/lib/outfit/llm-phrase.ts`) **no influye en el ranking**.

## Privacidad
- La ubicación del navegador se pide solo al tocar el botón; si se niega, se busca una ciudad.
- Las coordenadas se redondean a 1 decimal (~10 km) en el navegador y otra vez en el servidor, viajan en el cuerpo de un POST y **no se guardan ni se registran** (ni en base, ni en cookies, ni en URL, ni en logs). La respuesta no devuelve coordenadas ni ciudad.
- El servidor consulta Open-Meteo: ellos ven la IP de Vercel y la ubicación aproximada.
- No activar `logging.fetches.fullUrl` en Next: registraría las coordenadas.

## Servicios externos
- **Open-Meteo** (clima y geocodificación, sin clave): datos CC BY 4.0, atribución visible en la página y en `/creditos`. **El uso gratuito es solo no comercial**: si Scentia se monetiza, revisar sus términos o contratar el plan de pago. Caché de 30 min por coordenadas redondeadas.
- **Gemini** (opcional): apagado por defecto. Variables `OUTFIT_LLM_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL` (solo servidor). Recibe solo un resumen del clima y marca, nombre y acordes del perfume elegido. En el nivel gratuito Google puede usar el contenido para mejorar sus productos, por eso no se envía nada personal. Un intento, timeout corto, plantilla ante fallos. Confirmar modelo y cuota vigentes antes de activarlo.

## Límites
En memoria por instancia: 10/min por usuario en el endpoint, 20/min en la búsqueda de ciudades, 4/min en la frase con IA (freno parcial).

## Contexto con IA (ADR-011)
Si `OUTFIT_CONTEXT_LLM_ENABLED=true` (además de `GEMINI_API_KEY` y `GEMINI_MODEL`), debajo del resultado aparece un cuadro: "¿Qué vas a hacer hoy?". La persona escribe, por ejemplo, "voy a ver un partido de vóley en un lugar cerrado" y un modelo (Gemini) lo traduce a filtros de listas cerradas: **discreción** (`alta` o `media`), **liviano o intenso** y **proyección marcada**. El modelo no elige perfumes: el motor multiplica el puntaje del clima por un factor según cuán invasivo es cada perfume de tu colección (estela votada por la comunidad y peso de acordes densos o dulces), así que con discreción alta un perfume invasivo no es la primera opción salvo que no haya otro. Lo que viaja a Gemini es solo el texto escrito (hasta 200 caracteres); nunca la colección, la ubicación ni el clima. Si la interpretación falla, la recomendación se muestra igual, sin contexto.

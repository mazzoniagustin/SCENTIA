# Motor de recomendaciones (determinista)

Documentación del motor de similitud olfativa. Implementación viva en el repo:

| Pieza | Archivo |
| --- | --- |
| Scoring puro (fórmula, pesos, exclusiones) | `src/lib/similarity.ts` |
| Candidatos que comparten acordes/notas | `src/lib/candidates.ts` |
| Entradas de colección para exclusión | `src/lib/exclusions.ts` |
| Endpoint `GET /api/perfumes/[id]/recommendations` | `src/app/api/perfumes/[id]/recommendations/route.ts` |
| Tests de regresión | `src/lib/similarity.test.ts` |

> El código vive en `src/lib/` (no en `recommendations/`), porque el motor se
> descompuso en un solo módulo puro (`similarity.ts`) más dos adaptadores de
> acceso a datos. Esta carpeta solo documenta.

## Fórmula

El puntaje es una combinación lineal de dos dimensiones olfativas, normalizada
a `[0, 1]`:

```
score = W_ACCORDS · accordScore + W_NOTES · noteScore
```

### Acordes (`accordScore`)

Intersección ponderada por **intensidad**, usando el **mínimo** entre referencia
y candidato para no sobre-reportar cuando uno de los dos tiene el acorde apenas
presente:

```
accordScore = Σ min(intensidad_base, intensidad_candidato)   (sobre acordes compartidos)
              ─────────────────────────────────────────────
              Σ intensidad_base                              (todos los acordes de la base)
```

### Notas (`noteScore`)

Intersección ponderada por **fase olfativa**, con el peso tomado siempre de la
**referencia** para que numerador y denominador sean consistentes:

```
noteScore = Σ pesoFase(nota compartida) / Σ pesoFase(nota de la base)
```

## Pesos (constantes versionadas)

| Constante | Valor | Significado |
| --- | --- | --- |
| `W_ACCORDS` | `0.6` | Peso de la dimensión de acordes |
| `W_NOTES` | `0.4` | Peso de la dimensión de notas |
| `NOTE_TYPE_WEIGHTS.base` | `3` | La base define la firma del perfume |
| `NOTE_TYPE_WEIGHTS.heart` | `2` | El corazón aporta carácter |
| `NOTE_TYPE_WEIGHTS.top` | `1` | El top es volátil |

Las fases no reconocidas (cualquier valor distinto de `base`/`heart`/`top`)
contribuyen con peso `0`.

## Exclusiones

`calculateSimilarityScore` devuelve `0` — sin lanzar — cuando:

- el candidato está en la colección del usuario con estado `owned` o `disliked`
  (`EXCLUDED_STATUSES`); la exclusión prevalece sobre cualquier puntaje;
- la referencia no tiene acordes ni notas para comparar;
- las relaciones no fueron cargadas (`accords`/`notes` ausentes o vacíos).

`wishlist` y `sampled` **no** excluyen. `disliked` todavía no existe en el
schema (Fase 3), pero el motor lo anticipa para cerrar el vocabulario desde ya.

## Cómo extender a familia olfativa / afinidad de colección

La especificación (§11) reserva un bucket mayor — coincidencia olfativa 55 %,
concentración/variante 20 %, afinidad con la colección 20 %, diversidad 5 % —.
El motor actual cubre **solo la similitud olfativa** (acordes + notas) como
sub-puntaje normalizado. Para extenderlo sin romper el contrato:

1. **Familia olfativa**: agregar `familyId` a `Perfume` (relación a `Accord` o a
   un vocabulario `OlfactoryFamily`). Sumar una dimensión `familyScore` (0/1) y
   redistribuir los pesos dentro de `W_*` manteniendo la suma en `1`. Los tests
   de regresión (`similarity.test.ts`) detectan cualquier cambio accidental de
   los pesos existentes.
2. **Afinidad de colección**: añadir una dimensión `affinityScore` que consuma
   señales explícitas (`wishlist`, ratings, notas) vía `UserCollectionEntry`.
   Esas señales solo se leen con sesión; sin sesión valen cero y el resto se
   renormaliza.
3. **Nuevas dimensiones** se versionan como constantes `W_*` y se protegen con
   casos fijos de ranking, como ya hace el test de pesos por fase.

Toda dimensión nueva debe seguir el mismo principio: **determinista, explicable
y sin IA**, con una `reason` codificada (`shared_olfactory_family`,
`matches_collection_preference`, etc.) legible por el cliente.

## Ejecutar los tests

Sin dependencias externas (usa el runner nativo de Node ≥ 22):

```bash
node --test src/lib/similarity.test.ts
```
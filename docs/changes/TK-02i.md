# Change: TK-02i — Plantillas: «No especificado en el ticket.» en criterios de aceptación vacíos

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02i)
- **Depende de:** TK-02d (hecho y fusionado: `FileSystemManager.writeDocument` y las plantillas `historia` y `bug`).
- **INVEST:** Cumple. Un solo criterio técnico, dos plantillas y un único método bajo prueba; cabe en 3 escenarios y 4 tareas.

## Propósito

Cuando el ticket no trae escenarios, la sección «Criterios de aceptación» del documento queda vacía porque la plantilla no pinta nada con una lista vacía. Las plantillas `historia` y `bug` pasan a imprimir «No especificado en el ticket.» en ese caso, igual que el resto de campos ausentes, para que la persona sepa que falta y no que se perdió.

## Criterios de aceptación de origen

- CA1: con una Fase 1 sin escenarios, el documento generado (plantillas `historia` y `bug`) contiene «No especificado en el ticket.» bajo «Criterios de aceptación»; con escenarios, se renderizan como hasta ahora.
- DoD-a: ambas plantillas cubiertas por test.
- DoD-b: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

## Escenarios BDD

### E1 — Historia sin escenarios (cubre: CA1, DoD-a)

- **Given** un `FileSystemManager` con la plantilla real de `historia` y una Fase 1 de historia con `escenarios: []`
- **When** se llama a `writeDocument` con `tipo: "historia"`
- **Then** el documento contiene «No especificado en el ticket.» entre el encabezado «### Criterios de aceptación» y la sección siguiente; no hay ninguna línea `- [ ] CA…`; las demás secciones de la Fase 1 (descripción, user story, casos de uso, preguntas abiertas) y los marcadores de Fase 1 se escriben como hasta ahora

### E2 — Bug sin escenarios (cubre: CA1, DoD-a)

- **Given** un `FileSystemManager` con la plantilla real de `bug` y una Fase 1 de bug con `escenarios: []`
- **When** se llama a `writeDocument` con `tipo: "bug"`
- **Then** el documento contiene «No especificado en el ticket.» entre «### Criterios de aceptación» y la sección siguiente; no hay ninguna línea `- [ ] CA…`; las secciones «Qué falla» y «Cómo reproducir» y los marcadores de Fase 1 se escriben como hasta ahora

### E3 — Con escenarios se renderizan como hasta ahora (cubre: CA1, DoD-a)

- **Given** un `FileSystemManager` con las plantillas reales y una Fase 1 de historia y otra de bug con uno o más escenarios, y un documento ya escrito cuya Fase 2 la persona completó a mano
- **When** se llama a `writeDocument` con cada tipo, y de nuevo con `regenerateFase1Only` y una Fase 1 sin escenarios
- **Then** con escenarios aparece cada uno como `- [ ] CA<n>: <título>` con su Given, When y Then y **no** aparece «No especificado en el ticket.» en la sección de criterios; al regenerar solo la Fase 1 sin escenarios el texto aparece dentro de los marcadores y la Fase 2 escrita a mano se conserva intacta

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1, DoD-a | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «TK-02i · E1 — historia sin escenarios: «No especificado en el ticket.» en los criterios» (2 casos: la sección contiene exactamente la constante `NO_ESPECIFICADO` y ninguna línea de criterio; el resto de la Fase 1 y los marcadores no cambian) | Hecho |
| E2 | CA1, DoD-a | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «TK-02i · E2 — bug sin escenarios: «No especificado en el ticket.» en los criterios» (2 casos: la sección contiene exactamente la constante `NO_ESPECIFICADO` y ninguna línea de criterio; «Qué falla», «Cómo reproducir», las preguntas abiertas y los marcadores no cambian) | Hecho |
| E3 | CA1, DoD-a | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «TK-02i · E3 — con escenarios se renderizan como hasta ahora y la regeneración conserva la Fase 2» (5 casos: escenarios numerados con su Given, When y Then en historia y bug sin el texto nuevo; al regenerar sin escenarios el texto entra en los marcadores y la Fase 2 a mano se conserva, en historia y bug; al regenerar con escenarios reemplaza el texto) | Hecho |

DoD-b (revisión mergeada) no es un escenario: se tilda tras la merge.

## Prerrequisitos

- Ninguno. Verificado: las plantillas `templates/documents/historia.md.hbs` y `bug.md.hbs` existen y rinden los escenarios con `{{#each escenarios}}`; `FileSystemManager.writeDocument` las compila con Handlebars y `noEscape`; `tests/unit/services/filesystem/filesystem-manager.test.ts` ya tiene las fixtures `HISTORIA` y `BUG` y la función `fase1Block`.
- **Autorización expresa de la desarrolladora para tocar `templates/`** (2026-11-12): `/04-tdd-pair` solo escribe en `src/`, `tests/` y el contrato, así que al implementar debe citarla para modificar las dos plantillas. No se toca `package.json`, `eslint.config.js` ni `vitest.config.ts`.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `templates/documents/historia.md.hbs` | Modificar (existente, con autorización expresa): rama `{{else}}` del `{{#each escenarios}}` |
| `templates/documents/bug.md.hbs` | Modificar (existente, con autorización expresa): ídem |
| `tests/unit/services/filesystem/filesystem-manager.test.ts` | Modificar (existente): E1, E2 y E3. Solo se **añaden** casos |

## Tareas

- [x] 1. E1 en RED y GREEN: plantilla `historia` con «No especificado en el ticket.» sin escenarios
- [x] 2. E2 en RED y GREEN: la misma rama `{{else}}` en la plantilla `bug`
- [x] 3. E3 en RED y comprobación por mutación: con escenarios se renderizan como hasta ahora y la regeneración conserva la Fase 2
- [x] 4. Refactor, `npm run typecheck`, `npm run lint` y `npm test` sin regresiones

## Decisiones y desvíos

_Sin registros._

**Decisiones aprobadas por la desarrolladora (2026-11-12):**

1. La plantilla imprime «No especificado en el ticket.» en la sección «Criterios de aceptación» cuando no hay escenarios, y la desarrolladora autoriza expresamente tocar `templates/documents/historia.md.hbs` y `templates/documents/bug.md.hbs` para este ticket.

**Decisiones aprobadas por la desarrolladora (2026-11-12), tal cual se propusieron:**

2. *(ambiguo)* **Solo los criterios de aceptación.** Otras listas de la Fase 1 también quedan vacías sin avisar si el ticket no las trae (Casos de uso, Preguntas abiertas, y en bug «Cómo reproducir»); `docs/006` limita este ticket a los criterios y se mantiene así. Si quieres el mismo tratamiento para las demás, sería otro ticket.
3. **El literal vive en la plantilla.** El texto «No especificado en el ticket.» ya existe como constante `NO_ESPECIFICADO` en `src/services/ollama/postprocess.ts`, pero las plantillas son archivos versionados sin acceso a ella; se escribe el mismo literal en las dos plantillas (Handlebars `{{else}}` del `each`). Un test las compara con la constante para detectar que se desalinean.
4. **E3 es una prueba de regresión.** Los casos de «con escenarios» y de regeneración deberían pasar a la primera, porque protegen comportamiento existente; en lugar de una fase roja se comprueba con una mutación temporal (quitar el `{{#each}}` o imprimir el texto siempre) que los tests fallan.

**Registro al implementar (2026-11-12):**

5. **Plantilla modificada con la autorización expresa de la desarrolladora** (decisión 1): `templates/documents/historia.md.hbs` gana la rama `{{else}}` del `{{#each escenarios}}` con «No especificado en el ticket.». El test compara la sección con la constante `NO_ESPECIFICADO` de `src/services/ollama/postprocess.ts` (propuesta 3), así que si el literal de la plantilla se desalinea, falla.
6. **Plantilla `bug` modificada con la misma autorización expresa** (decisión 1): `templates/documents/bug.md.hbs` gana la misma rama `{{else}}` del `{{#each escenarios}}`. Con E1 y E2, ambas plantillas dicen lo mismo y las dos se comparan con `NO_ESPECIFICADO`.
7. **Mutaciones de comprobación de E3** (propuesta 4 aprobada). Los 5 casos salieron en verde a la primera, porque protegen comportamiento existente; se comprobó con tres mutaciones temporales de las plantillas que cada una hace fallar tests: imprimir el texto siempre, fuera del `{{#each}}` (3 fallos); quitar el `{{#each}}` dejando solo el texto (4 fallos); y desalinear el literal de `historia` respecto de la constante (2 fallos). Las plantillas se restauraron y quedan con las 2 líneas añadidas en cada una.

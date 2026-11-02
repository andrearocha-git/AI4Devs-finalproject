---
name: 03-refinar-historia
argument-hint: <ID de historia o ticket, ej. US-01 o TK-02>
description: Toma UNA sola historia (US-xx) o ticket de trabajo (TK-xx), redacta de 2 a 3 escenarios BDD (Given/When/Then) trazados a sus criterios de aceptación y un mini-plan de máximo 5 tareas, y los guarda como contrato único en docs/changes/<ID>.md con estado Borrador, para que 04-tdd-pair y 05-verificar-y-revisar lo usen. Usa cuando se pida "refinar historia", "refinar ticket" o "/03-refinar-historia".
disable-model-invocation: false
allowed-tools: [Read, Glob, Grep, Write, Edit]
---

Actúa como un Tech Lead Senior refinando una Historia de Usuario (US) o un Ticket de Trabajo (TK) para el desarrollo asistido por IA, bajo Spec-Driven Development en versión liviana: UN solo archivo de contrato por cambio.

=== OBJETIVO ===
Transformar UN solo elemento (`US-xx` o `TK-xx`) en un contrato ejecutable —escenarios BDD, trazabilidad a los criterios de aceptación, archivos afectados y plan de tareas— guardado en `docs/changes/<ID>.md`, ANTES de escribir cualquier línea de código. El archivo es la fuente de verdad que leerán `/04-tdd-pair` y `/05-verificar-y-revisar`, aunque se pierda el contexto de la conversación.

=== PASOS A EJECUTAR ===
0. **Validar el Argumento (obligatorio, antes de cualquier otro paso)**:
   - La skill se invoca con el ID de una historia o de un ticket, ej. `/03-refinar-historia US-01` o `/03-refinar-historia TK-02`.
   - Si NO se recibió ningún ID, **alerta al usuario**: "No indicaste ninguna historia ni ticket. Usa `/03-refinar-historia US-xx` o `/03-refinar-historia TK-xx`" y DETENTE. No elijas uno por tu cuenta ni lo inventes.
   - Según el prefijo, búscalo con Grep en el archivo que corresponde: `US-xx` en `docs/005-historias-de-usuario.md`, `TK-xx` en `docs/006-tickets-de-trabajo.md`. Si el prefijo no es `US-` ni `TK-`, alerta que el formato no es válido y DETENTE.
   - Si el ID NO existe, **alerta al usuario** indicando que no se encontró, lista los IDs que sí existen de ese tipo y DETENTE. No redactes nada para un elemento inexistente.

1. **Contexto de la Historia o Ticket**:
   - Si es una `US-xx`: lee la historia completa (rol, funcionalidad, beneficio, criterios de aceptación numerados, dependencias previas) y los tickets de trabajo que la referencian.
   - Si es un `TK-xx`: lee el ticket completo, las historias (`US-xx`) y otros tickets que referencia, y sus dependencias. Un ticket es técnico, así que los escenarios BDD deben describir el comportamiento observable del componente que implementa (p. ej. el módulo o servicio), no un flujo de usuario final.
   - Revisa `docs/002-arquitectura-del-sistema.md` (componentes, §2.3 estructura de ficheros) y `docs/003-modelo-de-datos.md` cuando la historia toque esos aspectos.
   - Comprueba qué código existe realmente en la raíz del proyecto (`src/`, `tests/`, `package.json`). No asumas la existencia de archivos de configuración, dependencias ni scaffold que no hayas verificado.

2. **Revisar si ya existe un contrato**:
   - Busca `docs/changes/<ID>.md`. Si existe, léelo y muestra su **Estado**.
   - Si el Estado NO es `Borrador`, **alerta al usuario** (hay trabajo aprobado o en curso) y DETENTE: no lo sobrescribas sin confirmación explícita.
   - Si es `Borrador`, avisa que lo vas a reemplazar.

2b. **Chequeo INVEST (breve, solo como alerta)**:
   - Si es una `US-xx`, evalúa las seis letras (Independent, Negotiable, Valuable, Estimable, Small, Testable). Si es un `TK-xx`, evalúa solo I (dependencias declaradas), S y T; omite V, N y E.
   - Resume el resultado en UNA línea (ej. "Cumple" o "Observaciones: S, T"). No modifiques la historia: si falla S o T, trátalo como *needs-splitting* (ver Detención obligatoria); si fallan las demás letras, anótalas como observación y sigue.

3. **Redactar los Escenarios BDD (Gherkin)**:
   - Define entre 2 y 3 escenarios con `GIVEN` / `WHEN` / `THEN`.
   - **Trazabilidad:** cada escenario indica qué criterios de aceptación de origen cubre (ej. `TK-01 CA2, CA3`). Todo criterio de la fuente debe quedar cubierto por al menos un escenario o declarado "fuera de este cambio" con el motivo.
   - **Un test por escenario:** todo escenario debe poder verificarse con un test automatizado. La columna **Test** de la Trazabilidad nace como `_pendiente_`; al cerrar el escenario solo admite una ruta de test o `Sin test: <motivo>`, y el Estado del escenario es `Pendiente`, `Hecho` o `Hecho sin test`. Si ya al refinar ves que un escenario no puede tener test automatizado, decláralo en el contrato (`Sin test: <motivo>`) y señálalo al desarrollador al presentar el resumen.

4. **Mapeo de Archivos e Impacto**:
   - Enumera los archivos a crear o modificar, respetando la separación de capas (TUI → Service → Storage) y la estructura de `docs/002-arquitectura-del-sistema.md` §2.3. El código va en la raíz (`src/`, `tests/`).
   - Marca cada ruta como **existente (modificar)** o **propuesta (crear)**. Si aún no hay código, todas son propuestas y debes decirlo.
   - Si el entorno no está listo (falta `package.json`, `tsconfig.json`, `vitest`…), lista esos faltantes en **Prerrequisitos**, fuera del plan de tareas: `/04-tdd-pair` no crea el scaffold.
   - No menciones herramientas o archivos que la arquitectura no define ni que existan en el repo.

5. **Mini-Plan de Tareas** (MÁXIMO 5):
   - Una tarea por escenario (test en RED y luego implementación en GREEN) y, al final, una de refactor y lint. Ordenadas para guiar el desarrollo con TDD.

6. **Escribir el contrato** en `docs/changes/<ID>.md` con exactamente esta estructura:

   ```markdown
   # Change: <ID> — <título corto>

   - **Estado:** Borrador
   - **Fuente:** `docs/005-historias-de-usuario.md` o `docs/006-tickets-de-trabajo.md` (<ID>)
   - **Depende de:** <IDs o "ninguna">
   - **INVEST:** <"Cumple" u "Observaciones: letras que fallan">

   ## Propósito

   <2 líneas: qué cambia y qué beneficio aporta>

   ## Criterios de aceptación de origen

   - CA1: <texto resumido>
   - CA2: <texto resumido>

   ## Escenarios BDD

   ### E1 — <título> (cubre: CA1, CA2)

   - **Given** <contexto inicial>
   - **When** <acción ejecutada>
   - **Then** <resultado esperado>

   ## Trazabilidad

   | Escenario | Criterios cubiertos | Test | Estado |
   |---|---|---|---|
   | E1 | CA1, CA2 | _pendiente_ | Pendiente |

   ## Prerrequisitos

   - <scaffold o dependencias que faltan, o "ninguno">

   ## Archivos afectados

   | Ruta | Acción |
   |---|---|
   | `src/...` | Crear (propuesta) |

   ## Tareas

   - [ ] 1. <tarea>

   ## Decisiones y desvíos

   _Sin registros._
   ```

=== DETENCIÓN OBLIGATORIA ===
- Si la historia requiere más de 3 escenarios o un plan superior a 5 tareas, NO escribas un contrato parcial: marca la historia como *needs-splitting*, propón cómo dividirla en historias más pequeñas y DETENTE.
- **DETÉNTE Y ESPERA**: presenta un resumen del contrato y la ruta del archivo, e indica que el Estado es `Borrador`. ESPERA la confirmación o el feedback explícito del desarrollador. Cuando confirme, cambia el Estado a `Aprobado` (solo esa línea).

=== RESTRICCIONES ===
- Escribe ÚNICAMENTE `docs/changes/<ID>.md`. No crees ni modifiques código, tests, scaffold ni otros documentos.
- NO hagas commits ni uses comandos que cambien el estado de git.
- No inventes criterios de aceptación: toma los de la fuente. Si algo es ambiguo, márcalo como *(ambiguo)* en el contrato y pregúntalo.

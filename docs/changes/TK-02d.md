# Change: TK-02d — FileSystem Manager y plantillas de documento

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02d)
- **Depende de:** TK-02a (hecho). Define la interfaz mínima de `DocumentoFase1` que TK-02e completará.
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre S: un solo criterio técnico con 4 operaciones (`createTicketWorkspace`, `readFase1`/`saveFase1`, `writeDocument`) y dos plantillas; se reparte en 3 escenarios y 4 tareas. Si crece al implementar, separar las plantillas del manager.

## Propósito

Gestor de archivos (ADR-004.1) que crea, **fuera del repositorio Git**, la carpeta del ticket por repositorio (`<raíz>\ID\<repo>\adjuntos\`), guarda y lee la Fase 1 reutilizable (`ID\.devflow\fase1.json`) y escribe el documento Markdown del tipo (`bug` o `historia`) con Handlebars. Al re-ejecutar un ticket regenera solo el bloque de Fase 1 y conserva la Fase 2 que el desarrollador ya escribió.

## Criterios de aceptación de origen

- CA4 (original): `FileSystemManager`: re-ejecutar sobre un ticket ya iniciado regenera solo el bloque de Fase 1 (entre `<!-- DEVFLOW:FASE1:INICIO -->` y `<!-- DEVFLOW:FASE1:FIN -->`), preservando intacta la Fase 2; ejecutar el mismo ticket con un segundo repositorio crea una carpeta y un documento propios y copia la Fase 1 guardada en `fase1.json`.
- DoD-a: ningún archivo se crea dentro del repositorio Git del desarrollador.
- DoD-b: un documento renderizado con `{ rawText }` lleva el aviso `⚠️ Generado sin Ollama`.
- DoD-c: hay al menos un test para `Ok` y para `ErrorBloqueante('PermisosInsuficientes')`.
- DoD-d: revisión de código aprobada y mergeada (se tilda tras la merge de la PR; no es un escenario).

Criterios de la historia relacionada (US-03) que este ticket cubre en su parte de disco: CA1 (carpeta de evidencias y documento de la plantilla del tipo), CA4 (documento con el contenido original sin redactar y aviso), CA6 (carpeta y documento propios por repositorio, Fase 1 reutilizada), CA7 (clave sin repositorios: solo documento) y CA9 (reprocesar solo la parte generada, conservando lo completado a mano). Los criterios de rama, Ollama y orquestación quedan en TK-02c, TK-02e y TK-02f.

## Escenarios BDD

### E1 — Carpetas del ticket fuera del repositorio y errores de permisos (cubre: US-03 CA1 y CA7 en disco, DoD-a, DoD-c)

- **Given** una raíz de tickets temporal, un `LocalFileStorage` real y otro que simula `EACCES` al crear carpetas
- **When** se ejecuta `createTicketWorkspace` con `ticketId` y `repositoryName`, sin `repositoryName`, repetido sobre carpetas que ya existen, con un `ticketId` o `repositoryName` que intenta salir de la raíz (`..`, separadores de ruta) y con el almacenamiento sin permisos
- **Then** con repositorio crea `<raíz>/<ID>/<repo>/adjuntos/` (el nombre de la subcarpeta sale de `adjuntosDirName`) y devuelve `Ok({ folderPath, documentPath })`; sin repositorio crea solo `<raíz>/<ID>/` (sin subcarpeta de repositorio ni `adjuntos`); repetirlo es idempotente y no borra nada; todas las rutas creadas cuelgan de la raíz recibida; un segmento no válido → `ErrorBloqueante('ErrorInesperado')` sin crear nada; sin permisos → `ErrorBloqueante('PermisosInsuficientes')` con un `message` que dice qué ruta falló y qué se alcanzó a crear

### E2 — Documento de Fase 1 + Fase 2 según el tipo, con o sin Ollama (cubre: US-03 CA1 y CA4 en disco, DoD-b)

- **Given** una Fase 1 estructurada (`DocumentoFase1`) y otra en fallback (`{ rawText }`), un `encabezado` (ID, título, URL de Jira, desarrollador/a, fecha, rama) y las plantillas `bug.md.hbs` y `historia.md.hbs`, basadas en `plantilla-user-story.md` de la desarrolladora
- **When** se ejecuta `writeDocument` con `tipo` `bug` e `historia`, con `regenerateFase1Only: false` y un `documentPath` que no existe, y otra vez sobre un documento ya existente
- **Then** escribe `documentPath` con la tabla de encabezado (Jira, Tipo ☑ Bug o Feature, Fecha, Proyecto, Rama Git, Desarrollador/a, PR # vacío; el dato que no se dio queda en blanco), el bloque de Fase 1 delimitado por `<!-- DEVFLOW:FASE1:INICIO -->` / `<!-- DEVFLOW:FASE1:FIN -->` y, fuera de él, la Fase 2 **tal cual está en la plantilla de la desarrolladora** y sin que la IA la toque (Datos del desarrollo, Evidencias —pruebas unitarias y evidencias de funcionamiento— y Observaciones); la Fase 1 de `bug` lleva Descripción, Qué falla, Cómo reproducir, Criterios de aceptación (casillas CA1… con su Given/When/Then), Casos de uso y Preguntas abiertas, y la de `historia` lleva Descripción, User Story, Criterios de aceptación, Casos de uso y Preguntas abiertas; con `{ rawText }` el bloque lleva `⚠️ Generado sin Ollama — completar manualmente` y el texto crudo; si el documento ya existe y no se pide regenerar, no se toca (idempotente) y devuelve `Ok`; el resultado es `Ok({ documentPath })`

### E3 — Fase 1 reutilizable y regeneración que preserva la Fase 2 (cubre: CA4, US-03 CA6 y CA9 en disco)

- **Given** un ticket con `fase1.json` guardado, un documento cuyo bloque de Fase 2 el desarrollador ya completó a mano, y un segundo repositorio del mismo ticket
- **When** se ejecuta `saveFase1` y `readFase1` (con y sin archivo, y con un JSON corrupto), `writeDocument` con `regenerateFase1Only: true` sobre el documento existente, y `createTicketWorkspace` + `writeDocument` para el segundo repositorio con la Fase 1 leída de `fase1.json`
- **Then** `saveFase1` escribe `<raíz>/<ID>/.devflow/fase1.json` y `readFase1` lo devuelve igual; sin archivo devuelve `Ok(null)`; con JSON corrupto o sin la forma de `DocumentoFase1` → `ErrorBloqueante('ErrorInesperado')` (no excepción); la regeneración reemplaza solo el texto entre los marcadores y deja byte a byte igual todo lo demás (Fase 2 y encabezado); un documento sin marcadores no se modifica y devuelve `ErrorBloqueante('ErrorInesperado')`; el segundo repositorio obtiene su carpeta y su documento propios con el mismo contenido de Fase 1, y el documento del primero no cambia

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | US-03 CA1/CA7 (disco), DoD-a, DoD-c | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «E1 — createTicketWorkspace» (22 casos: con y sin repositorio, `adjuntosDirName`, idempotencia, rutas bajo la raíz, 11 segmentos no válidos, `PermisosInsuficientes` con `EACCES`/`EPERM`/`EROFS` y `ErrorInesperado` con `ENOSPC`) | Hecho |
| E2 | US-03 CA1/CA4 (disco), DoD-b | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «E2 — writeDocument» (11 casos: historia, bug, Fase 2 fuera de los marcadores, `{ rawText }` en bug e historia, sin aviso si es estructurado, sin escapar HTML, sin encabezado, documento existente intacto, `PermisosInsuficientes` y plantilla ausente) | Hecho |
| E3 | CA4, US-03 CA6/CA9 (disco) | `tests/unit/services/filesystem/filesystem-manager.test.ts` › «E3 — Fase 1 reutilizable y regeneración» (14 casos: guardar y leer `fase1.json`, ticket sin archivo, 4 formas de JSON no válido, ID fuera de la raíz, permisos al guardar y al leer, regeneración que conserva encabezado y Fase 2 byte a byte, regeneración con `{ rawText }`, documento sin marcadores, regeneración sin documento y segundo repositorio) | Hecho |

DoD-d (revisión mergeada) no es un escenario: se tilda tras la merge.

## Prerrequisitos

- Dependencia de producción `handlebars`: **no está en `package.json`**. `/04-tdd-pair` necesita tu autorización para instalarla y tocar `package.json`.
- Archivos fuera de `src/` y `tests/` que `/04-tdd-pair` solo puede escribir con tu autorización: `templates/documents/bug.md.hbs`, `templates/documents/historia.md.hbs` y la sección de `templates/README.md` que los describe.
- Scaffold de TK-00, `AppConfig` y `StepResult` de TK-02a: **existen**, verificado (`ticketsRootPath` y `adjuntosDirName` ya salen de `AppConfigProvider`). La regla de lint de capas no impide que `src/services/filesystem/` importe `src/database/local-file-storage.ts` (solo restringe `sqlite-storage-manager`).
- Aún no existe `templates/documents/` ni `src/services/filesystem/`.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/database/local-file-storage.ts` | Crear (propuesta) |
| `src/services/filesystem/filesystem-manager.ts` | Crear (propuesta) |
| `src/shared/types/documento-fase1.types.ts` | Crear (propuesta) |
| `templates/documents/bug.md.hbs` | Crear (propuesta, requiere autorización) |
| `templates/documents/historia.md.hbs` | Crear (propuesta, requiere autorización) |
| `templates/README.md` | Modificar (requiere autorización) |
| `package.json` | Modificar: añadir `handlebars` (requiere autorización) |
| `tests/unit/services/filesystem/filesystem-manager.test.ts` | Crear (propuesta) |
| `docs/002-arquitectura-del-sistema.md`, `docs/006-tickets-de-trabajo.md`, `docs/009-flujo-funcional.md` | Modificar al cerrar el ticket (pendiente de autorizar, ver «Decisiones y desvíos») |

## Tareas

- [x] 1. E1 — RED: tests de `createTicketWorkspace` (con y sin repositorio, idempotencia, segmentos no válidos, `PermisosInsuficientes` con un almacenamiento que falla); GREEN: `LocalFileStorage` y `createTicketWorkspace`
- [x] 2. E2 — RED: tests de `writeDocument` (bug, historia, `{ rawText }`, documento existente); GREEN: tipo `DocumentoFase1`, plantillas Handlebars y escritura con los marcadores
- [x] 3. E3 — RED: tests de `saveFase1`/`readFase1`, de la regeneración que preserva la Fase 2 y del segundo repositorio; GREEN: persistencia de `fase1.json` y reemplazo del bloque entre marcadores
- [x] 4. Refactor, `npm run lint`, `npm run typecheck` y cobertura ≥ 80 % de `src/services/filesystem/` y `src/database/local-file-storage.ts`; revisar TSDoc en español de lo público

## Decisiones y desvíos

Propuestas por confirmar al aprobar el contrato (todas marcadas _(ambiguo)_ en la fuente o no previstas en ella):

- _(ambiguo)_ **`readFase1` y `saveFase1` no reciben la raíz de tickets:** la firma del ticket es `readFase1(ticketId)`, pero con solo el ID no se puede localizar `<raíz>\ID\.devflow\fase1.json`. Propuesta: `FileSystemManager` recibe `{ ticketsRootPath, adjuntosDirName }` por constructor (como el cliente de Jira) y `createTicketWorkspace` pasa a recibir solo `{ ticketId, repositoryName? }`. Alternativa: mantener `createTicketWorkspace` como está y añadir `ticketsRootPath` a `readFase1`/`saveFase1`.
- _(ambiguo)_ **`documentPath` lo calcula este manager:** `writeDocument` recibe `documentPath` y `createTicketWorkspace` solo devuelve `folderPath`. Propuesta: `createTicketWorkspace` devuelve además `documentPath` = `<folderPath>/<ID>.md` (sin repositorio: `<raíz>/<ID>/<ID>.md`). El nombre del archivo no lo fija ningún documento.
- _(ambiguo)_ **Documento existente sin `regenerateFase1Only`:** el ticket no dice qué hacer. Propuesta: no se toca y se devuelve `Ok` (nunca se pisa lo que el desarrollador completó). Reprocesar es `regenerateFase1Only: true`.
- _(ambiguo)_ **Forma de `DocumentoFase1`:** TK-02e define el tipo completo. Propuesta mínima en `src/shared/types/documento-fase1.types.ts`: `resumen`, `escenarios[] { titulo, given, when, then }`, `preguntasAbiertas[]`, los campos propios de `bug` (`pasosParaReproducir[]`, `comportamientoEsperado`, `comportamientoActual`, `entorno`) y de `historia` (`historiaUsuario { como, quiero, para }`, `casosDeUso[]`) como opcionales, más `generatedByOllama` y `promptVersion`. `presenteEnTicket` lo añade TK-02e porque aquí no se renderiza.
- _(asumido)_ **Fase 1 en fallback no se guarda:** `saveFase1` solo recibe `DocumentoFase1`; el orquestador (TK-02f) no guarda `fase1.json` si Ollama cayó en fallback, lo que ya produce el reintento automático de 009 §4.1. Si el JSON guardado trae `generatedByOllama: false`, `readFase1` lo devuelve igual: decidir si se reutiliza es del orquestador.
- _(asumido)_ **`LocalFileStorage`:** `docs/002` solo lista `write(path, content)` y `exists(path)`; para leer `fase1.json` y el documento existente hacen falta `read(path)` y `ensureDir(path)`. Propuesta: las cuatro operaciones, sin conocimiento del dominio, y un constructor con operaciones de disco inyectables (por defecto `node:fs/promises`) para simular `EACCES` en los tests sin depender de `chmod`, que no funciona igual en Windows.
- _(asumido)_ **Tipos de error:** `EACCES`, `EPERM` y `EROFS` → `PermisosInsuficientes`; cualquier otro fallo de disco, JSON corrupto, documento sin marcadores o segmento de ruta no válido → `ErrorInesperado`. Los mensajes no incluyen contenido del documento.
- _(asumido)_ **Segmentos de ruta:** `ticketId` y `repositoryName` se validan antes de tocar el disco (sin separadores, sin `..`, sin cadena vacía) para que no puedan salir de la raíz; el ticket no lo exige, pero DoD-a lo hace necesario.
- _(asumido)_ **DoD-a se verifica por rutas:** el manager no conoce el repositorio ni interactúa con Git (ADR-004.1), así que el test comprueba que toda ruta escrita cuelga de `ticketsRootPath` (un directorio temporal) y no que la raíz esté fuera de un repositorio.
- **Plantilla del documento** _(decidido por la desarrolladora, 2026-11-05)_: se parte de su `plantilla-user-story.md` (carpeta `ai4devs`, fuera del repositorio). La **Fase 2 se copia tal cual** —«Datos del desarrollo» (tablas, stored procedures, backend Java/Spring Boot, frontend Angular, otros), «Evidencias» y «Observaciones»— porque la IA no la toca. «Datos del desarrollo» ocupa el lugar de los «Objetos Modificados» del PRD, y la plantilla no incluye «Instrucciones de Pasaje a Producción»: la Fase 2 del PRD, `docs/001`, `docs/002` y `docs/009` se actualizan al cerrar el ticket.
- _(asumido)_ **Fase 1 respecto de la plantilla de la desarrolladora:** se quita «Objetivo del Jira» (ningún campo del schema de Ollama lo produce y añadirlo obligaría a TK-02e a subir `promptVersion`); se añaden «Casos de uso» y «Preguntas abiertas», que la plantilla no tiene y el sistema necesita (PRD y posprocesado `siFalta`); «Qué falla» y «Cómo reproducir» solo en `bug`, «User Story» solo en `historia`; los criterios de aceptación se renderizan desde `escenarios[]`.
- _(asumido)_ **Encabezado:** `writeDocument` recibe un objeto `encabezado` opcional `{ ticketId, titulo, jiraUrl, desarrollador, fecha, proyecto }` además de `repo` y `rama`; el proyecto se puede derivar del prefijo del ID. Lo que falta queda en blanco. El encabezado y la Fase 2 quedan fuera de los marcadores, así que la regeneración no los toca.
- _(asumido)_ **Plantillas:** se leen de `templates/documents/` con una ruta relativa al módulo, igual que `issue-types.json`; empaquetarlas para `dist/` queda para TK-03, ya anotado en las decisiones heredadas.
- _(asumido)_ **Rutas de Windows:** se usa `node:path` (el de la plataforma); los tests corren con directorios temporales de la plataforma. La prueba en Windows queda para el Hito 3, como en TK-02c.
- **Efecto en otros documentos (pendiente de autorizar):** al cerrar el ticket, actualizar la descripción de la Fase 2 en `docs/PRD.md`, `docs/001` y `docs/002` (secciones de la plantilla de la desarrolladora) y reflejar las firmas finales y `read`/`ensureDir` en `docs/006` (TK-02d), `docs/002` (Local File Storage) y `docs/009` (§3.2, §4.5), y tildar el DoD de TK-02c con los pendientes anotados para el primer commit de esta rama. Este contrato no los modifica.

Registro de la implementación de E1 (2026-11-05):

- **Decisiones aprobadas por la desarrolladora aplicadas:** `FileSystemManager` recibe `{ ticketsRootPath, adjuntosDirName }` por constructor y `createTicketWorkspace` solo `{ ticketId, repositoryName? }`; devuelve `documentPath` = `<folderPath>/<ID>.md` (con repositorio `folderPath` es `<raíz>/<ID>/<repo>`, sin repositorio `<raíz>/<ID>`); `LocalFileStorage` expone `ensureDir`, `write`, `read` y `exists` con operaciones de disco inyectables (`FileOps`).
- **Mensaje de `PermisosInsuficientes`:** nombra la ruta que falló y lista lo que se alcanzó a crear («No se alcanzó a crear nada» si no se creó ninguna carpeta). Las carpetas se crean una a una (ticket, repositorio, adjuntos) para poder informarlo.
- **`errorCode`:** helper exportado por `local-file-storage.ts` para leer el `code` de un error de Node; lo usa también el manager.

Registro de la implementación de E2 (2026-11-05):

- **Autorizaciones de la desarrolladora aplicadas:** instalación de `handlebars` (`^4.7.10`, en `dependencies`), creación de `templates/documents/bug.md.hbs` y `historia.md.hbs`, y la sección `documents/` de `templates/README.md`.
- **Fase 2 idéntica a la plantilla de la desarrolladora:** se comprobó con `diff` contra `plantilla-user-story.md` (cero diferencias) y que es igual en las dos plantillas.
- _(asumido, no previsto en el contrato)_ **Fila «Repositorio» en el encabezado:** la plantilla de la desarrolladora no la tiene, pero hay un documento por repositorio y el contrato manda que `repo` se muestre; se añadió una fila a la tabla.
- _(asumido)_ **«Casos de uso» en `bug`:** el contrato lo lista en la Fase 1 de `bug`, pero el schema de `bug` de TK-02e no tiene `casosDeUso`; la sección de `bug` solo aparece si el campo existe. En `historia` aparece siempre.
- _(asumido)_ **Motor de plantillas:** `Handlebars.create()` (instancia propia, no la global) con `noEscape: true`, porque el resultado es Markdown y un apóstrofo no debe salir como `&#x27;`; helper `inc` para numerar desde 1.
- _(asumido)_ **Errores de `writeDocument`:** plantilla ausente o fallo de lectura → `ErrorInesperado`; `EACCES`/`EPERM`/`EROFS` al escribir → `PermisosInsuficientes` con la ruta del documento.
- `regenerateFase1Only` se acepta pero aún no se usa: lo implementa E3.

Registro de la implementación de E3 y cierre (2026-11-05):

- _(asumido)_ **Regeneración:** se renderiza el documento completo con la plantilla y solo se copia el texto entre los marcadores al documento existente; encabezado y Fase 2 no se tocan. Si el documento a regenerar no existe, se crea completo; si existe pero le faltan los marcadores (o están al revés), `ErrorInesperado` y el archivo queda intacto.
- _(asumido)_ **Validación de `fase1.json`:** `readFase1` comprueba la forma mínima de `DocumentoFase1` (`resumen`, `escenarios`, `preguntasAbiertas`, `generatedByOllama`, `promptVersion`) y no el contenido de cada escenario; un JSON ilegible o con otra forma es `ErrorInesperado`, y un fallo de lectura por permisos, `PermisosInsuficientes`.
- **Cierre:** 261 tests en total en el proyecto, `typecheck` y `lint` limpios; cobertura de `src/services/filesystem/` ≥ 97 % de sentencias y 93 % de ramas; todo export público tiene TSDoc en español. _(Corregido tras `/05`: la cobertura de `src/database/local-file-storage.ts` no era «completa», sino 91,7 % de sentencias y 77,8 % de ramas, porque `vitest.config.ts` solo mide `src/services/**` y esa cifra no se había medido.)_

Corrección tras `/05-verificar-y-revisar` (2026-11-05):

- **Cobertura de `local-file-storage.ts`:** `exists` relanzando un error distinto de `ENOENT` no tenía test (ramas 77,8 %, bajo el 80 % de la tarea 4). Se añadió `tests/unit/database/local-file-storage.test.ts` (6 casos: `exists` con y sin archivo, `EACCES`/`EPERM` y error sin código propagados, `write` + `read` con carpetas intermedias y `errorCode`). Resultado: 100 % de sentencias, ramas, funciones y líneas; 267 tests en total.
- **Decisión de la desarrolladora (2026-11-05): no ampliar el umbral de cobertura a `src/database/`.** `vitest.config.ts` sigue midiendo solo `src/services/**`. Motivo: `src/database/` ya está en 95,7 % de sentencias y 97 % de ramas, ningún ticket lo pide y tocar la configuración arriesga romper `npm run test:coverage` por un umbral que nadie necesita. Si se quiere vigilar esa capa más adelante, es un cambio de una línea.

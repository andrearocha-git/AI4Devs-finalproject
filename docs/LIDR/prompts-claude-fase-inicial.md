# Prompts Claude — Fase Inicial (Documentos 000-003, PRD, ADR y READMEs)

> Registro de los prompts e intercambios con Claude Code utilizados para armar el PRD (`docs/PRD.md`), el ADR de arquitectura inicial (`docs/ADR-001-arquitectura-inicial.md`), los documentos `docs/000-*.md` a `docs/003-*.md`, y el `README.md` del proyecto DevFlow CLI. No incluye la conversación previa de configuración de `CLAUDE.md` (no forma parte de estos documentos de producto/arquitectura).

---

## Prompt 1

**PROMPT TITULO:** Generación inicial del PRD de DevFlow CLI a partir del contexto del problema

**PROMPT:**
````
Actúa como un Lead Product Manager y Arquitecto de Software Senior especializado en Developer Experience (DevEx).

=== CONTEXTO DEL PROBLEMA ===
Somos un equipo de desarrollo de 5 ingenieros que trabajamos en paralelo sobre 6 proyectos (4 backend en Java Spring Boot y 2 frontend en Angular) en entornos Windows 10/11.
Actualmente, al tomar una User Story de Jira, los desarrolladores sufren de constante cambio de contexto (saltando entre la web de Jira, la terminal de Git, el explorador de archivos y Google Drive). Cada uno crea sus ramas de Git, carpetas y documentos de desarrollo de manera libre y no estandarizada.
Esto genera alta fricción para el desarrollador, dificulta el trabajo de QA/Testing al armar casos de prueba y complica el pasaje a producción por falta de un registro claro de objetos modificados.

=== OBJETIVO DEL PRODUCTO ===
Crear una herramienta CLI amigable (TUI) para Windows que elimine el cambio de contexto del desarrollador, automatizando en un solo comando:
1. La consulta a la API de Jira para extraer el contexto del ticket.
2. La creación automática de la rama en Git (ej. 'feature/ID-123-resumen' o 'bugfix/ID-123-resumen') dentro del repositorio correspondiente.
3. La creación de la estructura de carpetas local por ticket (`/ticket-ID/adjuntos/`).
4. La generación inteligente del documento de desarrollo en Markdown enriquecido con un LLM local (Ollama).

=== FLUJO DE GENERACIÓN DEL DOCUMENTO DE DESARROLLO ===
1. La herramienta consulta la API de Jira con el ID del ticket.
2. Identifica el repositorio local afectado e invoca Git para crear y cambiar a la nueva rama estandarizada.
3. Un LLM local (Ollama) procesa el texto crudo de Jira y autogenera las primeras secciones del documento Markdown:
   - **Descripción y Contexto:** Resumen estructurado del problema.
   - **Casos de Uso:** Desglose del flujo funcional.
   - **Criterios de Aceptación:** Formato estandarizado Gherkin ('Given / When / Then').
4. La plantilla incluye secciones estandarizadas que el desarrollador completará durante el ciclo de vida del ticket:
   - **Objetos Modificados:** Tablas de BD, endpoints API, clases Java / componentes Angular.
   - **Evidencias de Pruebas:** Enlaces a archivos colocados en la subcarpeta local 'adjuntos/'.
   - **Instrucciones de Pasaje a Producción:** Checklist y scripts requeridos para el despliegue.

=== TU MISIÓN EN ESTE TURNO ===
Genera el documento de Descripción General del Producto (PRD) en formato Markdown para guardarse en 'docs/PRD.md' y sintetizarse en el 'README.md' principal.

El documento debe estructurarse estrictamente así:
1. **Ficha del Proyecto:** Nombre del producto, versión (v1.0 MVP), autor, entorno (Windows CLI) y repositorio.
2. **Descripción General:** Problema detallado, solución propuesta y propuesta de valor para Devs, QA y DevOps.
3. **Alcance del MVP (In Scope):**
   - Interfaz CLI TUI interactiva para terminal Windows.
   - Persistencia local de configuración e historial en SQLite.
   - Integración REST con API de Jira (con fallback manual si no hay conexión).
   - Creación automática de rama Git en el repositorio correspondiente según la convención del equipo.
   - Procesamiento con Ollama para estructuración Gherkin del Markdown.
   - Estructura de carpetas local (`/ticket-ID/adjuntos/`).
4. **Límites Explícitos (Out of Scope / Non-Goals):**
   - **Sin generación de código:** Ollama NO generará, escribirá ni desarrollará código fuente (clases Spring Boot, componentes Angular, scripts, etc.). Su función se limita estrictamente a procesar el texto de Jira y estructurar la documentación en Markdown.
   - **Sin interfaz gráfica (GUI ni Web):** La herramienta funcionará exclusivamente desde la terminal / línea de comandos (CLI / TUI). NO incluirá ventanas de escritorio (Electron, Tauri, etc.) ni paneles web en el navegador.
   - Sincronización automática con Google Drive por API (diferido a v2).
5. **Criterios de Éxito Medibles:**
   - Reducción del cambio de contexto (*context switching*) del desarrollador al iniciar un ticket.
   - 100% de cumplimiento en la nomenclatura de ramas Git y documentos de entrega para QA.

=== RESTRICCIONES ===
- Lenguaje: Español técnico profesional.
- No generes código de implementación aún. Limítate a la especificación del producto.
````

**RESPUESTA CLAUDE:**
````
Generé ambos documentos:

- **`docs/PRD.md`** — el PRD completo con la estructura exacta que pediste: Ficha del Proyecto, Descripción General (problema, solución, propuesta de valor por rol), Alcance del MVP, Límites Explícitos, Criterios de Éxito Medibles.
- **`README.md`** (nuevo, en la raíz) — síntesis ejecutiva del PRD, enlazando al documento completo. Lo dejé claramente diferenciado del `readme.md` en minúsculas ya existente, que es la plantilla de entrega del curso AI4Devs (esa no la toqué).

Dos cosas que dejé marcadas como pendientes de tu decisión, en vez de inventarlas:

1. **Nombre del producto** en la ficha del PRD — usé "DevFlow CLI" como nombre de trabajo (placeholder explícito). Decime el nombre real y lo reemplazo en ambos archivos.
2. **Repositorio** en la ficha — puse este mismo repo (`AI4Devs-finalproject`) por ser donde estamos trabajando; avisame si el proyecto va a vivir en un repo aparte.

No generé código ni estructura de carpetas de implementación, tal como pediste — esto es solo la especificación de producto.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 2

**PROMPT TITULO:** Confirmación del nombre del producto y del repositorio de trabajo

**PROMPT:**
````
Sí, dejemos el nombre DevFlow CLI y dejemos el mismo repo, vamos a trabajar acá mismo
````

**RESPUESTA CLAUDE:**
````
Confirmado el nombre **DevFlow CLI** en el PRD (ya solo quedaba el placeholder de "nombre de trabajo", lo dejé fijo). El repositorio ya apuntaba a este mismo repo en ambos documentos, así que no hizo falta tocarlo ahí.

¿Seguimos con el siguiente paso — por ejemplo la arquitectura del sistema / diagrama, o el modelo de datos para SQLite?
````

**MODELO USADO:** Sonnet 5

---

## Prompt 3

**PROMPT TITULO:** Creación de los archivos Markdown vacíos del índice de entrega (000 a 007) en `docs/`

**PROMPT:**
````
Creame estos archivos markdown vacios dentro de la carpeta docs del proyecto:
1. [Descripción general del producto](001-descripción-general-del-producto.md)

2. [Arquitectura del sistema](002-arquitectura-del-sistema.md)

3. [Modelo de datos](003-modelo-de-datos.md)

4. [Especificación de la API](004-especificación-de-la-api.md)

5. [Historias de usuario](005-historias-de-usuario.md)

6. [Tickets de trabajo](006-tickets-de-trabajo.md)

7. [Pull requests](007-pull-requests.md)
````

**RESPUESTA CLAUDE:**
````
Creados los 7 archivos vacíos en `docs/`.

Una cosa a tener en cuenta: en `prompts.md` (que noto que fue editado y ahora tiene un índice con estos mismos enlaces) las rutas están escritas como `001-descripción-general-del-producto.md`, sin el prefijo `docs/`. Como `prompts.md` vive en la raíz del repo, esos enlaces van a apuntar a la raíz y no a `docs/`, así que quedarán rotos tal como están. Decime si querés que ajuste los enlaces en `prompts.md` (y en `readme.md` si tiene el mismo índice) para que apunten a `docs/00X-*.md`.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 4

**PROMPT TITULO:** Corrección de los enlaces del índice de `prompts.md` hacia `docs/`

**PROMPT:**
````
Sí, corrígelos para que apunten a docs/
````

**RESPUESTA CLAUDE:**
````
Corregido en `prompts.md` — los 7 enlaces del índice ahora apuntan a `docs/00X-*.md`.

`readme.md` no necesitó cambios: su índice usa anclas internas a sus propias secciones (`#1-descripción-general-del-producto`, etc.), no enlaces a archivos, así que no hay nada roto ahí.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 5

**PROMPT TITULO:** Reversión del índice de `prompts.md` a anclas internas (no enlaces a archivos)

**PROMPT:**
````
en prompts.md deja la parte del indice como estaba antes, entiendo que es el indice del archivo
````

**RESPUESTA CLAUDE:**
````
Listo, el índice de `prompts.md` vuelve a apuntar a sus propias secciones (`#1-descripción-general-del-producto`, etc.), igual que en `readme.md`, en lugar de a los archivos de `docs/`.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 6

**PROMPT TITULO:** Generación de la Ficha del Proyecto (`000-ficha-del-proyecto.md`) a partir del PRD

**PROMPT:**
````
genera un archivo 000-ficha-del-proyecto.md en la carpeta docs y completalo con la estructura que tiene el readme.md en la seccion 0 obteniendo los datos del PRD
````

**RESPUESTA CLAUDE:**
````
Creado `docs/000-ficha-del-proyecto.md` con la misma estructura de la sección 0 de `readme.md`, completado con los datos del PRD (nombre del producto, autor, descripción breve derivada del problema/solución) y la URL del repo obtenida del remote de git.

Nota: el repo en GitHub es privado por lo que veo del remote (`git@github.com:andrearocha-git/AI4Devs-finalproject.git`) — si es privado, recordá que la plantilla del curso pide compartir accesos de forma segura (ver la nota en `readme.md` sección 0.4/0.5).
````

**MODELO USADO:** Sonnet 5

---

## Prompt 7

**PROMPT TITULO:** Completar documentos 001-007 con datos del PRD, marcar vacíos como `[A definir]` y quitar tildes de los nombres de archivo

**PROMPT:**
````
Con la información obtenida del PRD , completa el archivo 001-descripción-general... con la estructura del readme de la seccion 1, y haz lo mismo con los demas archivos. Lo que no está no lo asumas , deja una marca [A definir] . y renombra los archivos que tengan tildes, quitalas
````

**RESPUESTA CLAUDE:**
````
Listo. Resumen de lo hecho:

**Renombrados** (sin tildes):
- `001-descripción-general-del-producto.md` → `001-descripcion-general-del-producto.md`
- `004-especificación-de-la-api.md` → `004-especificacion-de-la-api.md`
- Los demás (`000`, `002`, `003`, `005`, `006`, `007`) ya no tenían tildes.

**Completados con la estructura de `readme.md` + datos del PRD:**
- **001** — Objetivo, características/funcionalidades (del alcance del MVP). *Diseño/UX* e *Instrucciones de instalación* → `[A definir]` (el PRD no cubre eso).
- **002** — Componentes principales listados a partir del alcance del PRD (Jira, Git, LLM local, SQLite, CLI/TUI). Diagrama, estructura de ficheros, infraestructura/despliegue, seguridad y tests → `[A definir]` (no están en el PRD).
- **003** — Entidades conceptuales mencionadas en el PRD (Configuración, Historial de tickets). Diagrama y atributos/relaciones detallados → `[A definir]`.
- **004** — Nota explícita de que el PRD no define una API propia expuesta por la herramienta (solo consume la API de Jira); el resto → `[A definir]`.
- **005, 006, 007** — Se mantuvieron los encabezados de plantilla (Historia/Ticket/Pull Request 1-3) con `[A definir]`, ya que el PRD no contiene historias de usuario, tickets ni PRs concretos.

No se tocaron `readme.md` ni `prompts.md` en este paso.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 8

**PROMPT TITULO:** Auditoría crítica del PRD como Auditor Principal de Producto / Lead QA (DevEx)

**PROMPT:**
````
Actúa como un Auditor Principal de Producto y Lead QA especializado en Herramientas de Ingeniería (DevEx).

=== CONTEXTO ===
Hemos generado la primera versión de nuestro PRD en 'docs/PRD.md' para una herramienta CLI (TUI) de Windows 10/11 que estandariza el inicio de tareas de desarrollo desde Jira, crea ramas en Git, genera carpetas locales y utiliza un LLM local (Ollama) para formatear la documentación en Markdown.

=== TU MISIÓN EN ESTE TURNO ===
Realiza una auditoría crítica y exhaustiva del documento 'docs/PRD.md'. No aplaudas el trabajo; busca vacíos, ambigüedades, riesgos de alcance (scope creep) y puntos débiles.

Evalúa el documento frente a los siguientes 6 puntos de control:

1. **Evaluación de Fronteras (Non-Goals):**
   - ¿Queda 100% claro e inequívoco que Ollama NO generará código fuente (Java/Angular)?
   - ¿Queda 100% claro que NO hay interfaz web ni GUI de escritorio?
   - Si detectas alguna redacción ambigua que pueda confundir a un evaluador, señálala y propone la redacción exacta corregida.

2. **Manejo de Fallos y Resiliencia (Edge Cases):**
   - ¿El PRD especifica el comportamiento cuando la API de Jira no responde (ej. red caída o token inválido)?
   - ¿Especifica qué ocurre si Ollama no está en ejecución en la PC del desarrollador (mecanismo de Fallback)?

3. **Ciclo de Vida del Ticket en la Plantilla Markdown:**
   - ¿La estructura de la plantilla diferencia claramente lo que se genera al INICIO (Contexto, Casos de Uso, Gherkin) de lo que completa el Dev al FINALIZAR (Objetos modificados, Evidencias en 'adjuntos/', Pasaje a Prod)?

4. **Análisis de Fricción (DevEx):**
   - ¿El flujo propuesto realmente elimina el cambio de contexto del desarrollador o le agrega pasos manuales innecesarios?

5. **Factibilidad del MVP:**
   - ¿Existe alguna funcionalidad 'In Scope' que consideres excesiva para una v1.0 y que debería postergarse a la v2.0?

6. **Métricas de Éxito:**
   - ¿Las métricas definidas son medibles y objetivas?

=== FORMATO DE RESPUESTA ===
Estructura tu dictamen en:
- 🔴 **Hallazgos Críticos / Puntos Ciegos** (Lo que debe corregirse inmediatamente).
- 🟡 **Oportunidades de Mejora** (Sugerencias para afinar la especificación).
- 🟢 **Veredicto:** [APROBADO CON CAMBIOS / RECHAZADO].
- 📝 **Bloque de Parches:** Texto exacto formateado en Markdown para reemplazar o añadir en 'docs/PRD.md' para solucionar cada hallazgo.
````

**RESPUESTA CLAUDE:**
````
# 🔍 Auditoría — `docs/PRD.md` (DevFlow CLI, v1.0 MVP)

## 🔴 Hallazgos Críticos / Puntos Ciegos

**H1 — Sin comportamiento definido si Ollama no está corriendo (Control 2).**
El PRD detalla el fallback para Jira (§3, bullet 3) pero **no dice absolutamente nada** sobre qué pasa si Ollama no está levantado, no tiene el modelo instalado, o se cuelga procesando. Tal como está redactado, un evaluador puede asumir que si Ollama falla, **todo el flujo se bloquea** (no se crea ni rama ni carpeta), lo cual contradice el objetivo central de "eliminar fricción". Este es el vacío más grave del documento.

**H2 — Ambigüedad real en el límite "sin generación de código" (Control 1).**
La redacción actual (§4) prohíbe generar "clases Spring Boot, componentes Angular, scripts de migración, etc." — una lista de *ejemplos*, no una regla cerrada. No aclara si Ollama puede colar un **snippet ilustrativo** (un `curl`, un JSON de ejemplo, un `ALTER TABLE`) dentro de "Casos de Uso" al redactar el flujo funcional. Un evaluador estricto puede leer esto como zona gris. También falta aclarar si **Gherkin cuenta como código** (no debería, pero hay que decirlo explícitamente).

**H3 — El mecanismo de autenticación contra Jira no está definido, y eso pone en riesgo el Non-Goal de "sin Web/GUI" (Controles 1 y 2).**
Si la integración usa OAuth 2.0 (común en Jira Cloud), típicamente requiere abrir el navegador y un callback — es decir, **un componente web dentro del flujo de una herramienta que declara "cero Web"**. El PRD no descarta esto. Además, tampoco distingue tipos de fallo de la API (red caída vs. token inválido/expirado vs. ticket inexistente) — el brief pide explícitamente esta distinción y hoy está tratada como un caso genérico ("si la consulta falla").

**H4 — La métrica de éxito #1 no es objetivamente medible (Control 6).**
"Reducción del cambio de contexto" no tiene baseline, ni target numérico, ni método de medición. Es una intención, no una métrica. El brief pide explícitamente verificar esto y falla.

**H5 — Tickets multi-repositorio no contemplados (Controles 4 y 5).**
El contexto del propio PRD dice que el equipo trabaja "en paralelo sobre 6 proyectos" (4 backend + 2 frontend). Es razonable asumir que hay historias "full-stack" que tocan un repo backend y uno frontend a la vez. El documento habla siempre de "el repositorio correspondiente" (singular) y no dice qué pasa en ese caso — riesgo de que el desarrollador termine ejecutando el flujo dos veces sin que la herramienta lo sepa, o de scope creep cuando alguien pida "que la herramienta maneje N repos por ticket".

---

## 🟡 Oportunidades de Mejora

**M1 — El ciclo de vida INICIO/FIN de la plantilla es correcto en contenido pero no está explícito como fases (Control 3).**
Hoy vive como dos bullets sueltos dentro de §3. Está bien lo que dice, pero conviene declarar explícitamente "Fase 1 (auto-generada al crear el ticket)" vs. "Fase 2 (completada por el Dev antes del cierre)" para que nadie diseñe la plantilla con las secciones mezcladas.

**M2 — "Confirmación de acciones" paso a paso puede reintroducir fricción (Control 4).**
Si la TUI pide confirmar cada acción (rama, carpeta, documento) por separado, son 3-4 interrupciones manuales en vez de 1. Recomendación: una única confirmación que resuma todas las acciones antes de ejecutarlas.

**M3 — Selección manual de repositorio/proyecto es un paso manual evitable (Control 4).**
Si el ticket de Jira trae el `project key` o componente, se puede mapear automáticamente a la ruta local del repo (config ya prevista en SQLite) y dejar la selección manual solo como *override*, no como paso default.

**M4 — Historial completo en SQLite puede ser más de lo que un v1.0 necesita (Control 5).**
El alcance actual mezcla "configuración editable" + "historial persistente y consultable" en SQLite. Para el MVP, ninguna métrica de éxito depende de poder *consultar* histórico — solo de que la rama/documento se creen bien. Candidato a recorte: llevar un registro mínimo (append-only) en v1, y dejar reporting/consultas ricas sobre histórico para v2.

**M5 — Faltan métricas que midan la fricción residual (Control 6).**
Además de nomenclatura, conviene medir: tiempo de arranque del ticket (antes/después) y % de tickets que necesitan fallback (Jira u Ollama) — esto último es además el mejor indicador temprano de que H1/H3 están bien resueltos en la práctica.

**M6 — Requisitos de hardware/modelo de Ollama no mencionados.**
No es bloqueante para el PRD, pero si cada dev corre un LLM local en su laptop Windows, conviene al menos una nota de que el modelo/tamaño se definirá en la fase técnica, para no descubrirlo tarde como riesgo de factibilidad.

---

## 🟢 Veredicto: **APROBADO CON CAMBIOS**

La visión y el alcance del MVP son sólidos y el corte In/Out of Scope está en general bien pensado. Pero el documento **no puede pasar a diseño técnico tal cual está** porque dos de sus propios pilares —resiliencia (Ollama) y medibilidad del éxito— tienen vacíos que el propio brief pedía verificar explícitamente. Con los parches de H1–H5 aplicados, queda listo para pasar a arquitectura (`002-arquitectura-del-sistema.md`).

---

## 📝 Bloque de Parches para `docs/PRD.md`

**Parche 1 — Reemplazar en `## 3. Alcance del MVP`, el bullet de integración con Jira:**

```markdown
- **Integración REST con la API de Jira**, autenticada mediante **API Token / Personal Access Token** configurado localmente (sin flujo OAuth con redirección a navegador, para no introducir un componente web en el flujo — ver §4). Ante un fallo de esta integración, la herramienta distingue al menos tres causas y activa el **modo fallback manual** en todas ellas: (a) **red caída / sin respuesta** (timeout), (b) **token inválido o expirado** (401/403), (c) **ticket inexistente** (404). En los tres casos, informa el motivo del fallo cuando es identificable y permite al desarrollador ingresar manualmente los datos mínimos del ticket (ID, título, descripción) para continuar el flujo sin bloquear la creación de rama y carpetas.
```

**Parche 2 — Añadir nuevo bullet en `## 3. Alcance del MVP`, inmediatamente después del bullet de "Procesamiento con Ollama":**

```markdown
- **Resiliencia del procesamiento con Ollama**: si el servicio no está en ejecución, no responde dentro de un timeout definido, o no tiene el modelo requerido instalado, la herramienta **no bloquea el flujo**. Crea igualmente la rama Git y la estructura de carpetas, y genera el documento Markdown con el texto crudo de Jira sin estructurar en las secciones correspondientes, marcado con el aviso `⚠️ Generado sin Ollama — completar manualmente`. El desarrollador puede continuar de inmediato y, opcionalmente, reprocesar el documento más tarde cuando Ollama esté disponible.
```

**Parche 3 — Reemplazar en `## 3. Alcance del MVP`, el bullet de "Plantilla estandarizada" para explicitar las dos fases (Control 3):**

```markdown
- **Plantilla del documento, en dos fases explícitas:**
  - **Fase 1 — Generada automáticamente al crear el ticket:** Descripción y Contexto, Casos de Uso, Criterios de Aceptación en Gherkin (procesados por Ollama a partir del texto de Jira).
  - **Fase 2 — Completada manualmente por el desarrollador durante el ciclo de vida del ticket, antes del pasaje a producción:** Objetos Modificados, Evidencias de Pruebas (enlaces a `adjuntos/`), Instrucciones de Pasaje a Producción.
```

**Parche 4 — Reemplazar en `## 4. Límites Explícitos`, el bullet "Sin generación de código":**

```markdown
- **Sin generación de código, en ningún formato.** Ollama **no** generará, escribirá, completará ni sugerirá código fuente ni fragmentos de código en ningún lenguaje o sintaxis (clases Java/Spring Boot, componentes/servicios Angular, scripts SQL o de migración, comandos de shell, snippets JSON/YAML, etc.), **ni siquiera a modo de ejemplo ilustrativo** dentro del documento generado. Su función se limita estrictamente a: (a) procesar el texto en lenguaje natural del ticket de Jira, y (b) estructurar ese contenido como prosa y listas en Markdown, incluyendo el formato Gherkin — que se considera **lenguaje de especificación de comportamiento, no código fuente**. Cualquier bloque de código que termine apareciendo en el documento (p. ej. en "Objetos Modificados") es ingresado manualmente por el desarrollador, nunca por el LLM.
```

**Parche 5 — Añadir dos bullets nuevos al final de `## 4. Límites Explícitos`:**

```markdown
- **Sin autenticación OAuth con redirección a navegador.** La autenticación contra Jira se realiza exclusivamente mediante API Token / Personal Access Token configurado localmente, para no introducir un componente web dentro del flujo de la herramienta (ver §3).
- **Sin soporte para tickets multi-repositorio en una misma ejecución.** Cada ejecución de la herramienta opera sobre un único repositorio local. Un ticket que requiera cambios en más de un repositorio (p. ej. backend y frontend) se procesa ejecutando la herramienta una vez por repositorio afectado.
```

**Parche 6 — Reemplazar por completo `## 5. Criterios de Éxito Medibles`:**

```markdown
## 5. Criterios de Éxito Medibles

- **Tiempo de arranque del ticket**: tiempo desde que el desarrollador tiene el ID del ticket hasta que tiene la rama creada, la carpeta local lista y el documento base generado. Meta: ≤ 2 minutos por ticket usando la herramienta (baseline manual actual a medir en el equipo antes del lanzamiento).
- **Cobertura de flujo sin salir de la terminal**: 100% de las acciones de arranque (consulta de contexto, creación de rama, creación de carpetas, generación del documento base) ejecutadas dentro de la TUI, sin que el desarrollador abra manualmente el navegador, una terminal de Git aparte o el explorador de archivos.
- **100% de cumplimiento en la nomenclatura** de ramas Git y documentos de entrega generados por la herramienta, verificable por QA mediante validación automática (lint de nombres), sin intervención manual de corrección.
- **Tasa de éxito sin fallback**: % de tickets cuyo documento se genera sin necesidad de fallback manual (ni de Jira ni de Ollama), medido durante el primer mes de adopción, como indicador temprano de fricción residual.
```

---

¿Aplico estos 6 parches directamente sobre `docs/PRD.md`, o preferís revisarlos primero y decirme si ajusto algo (por ejemplo el target de "≤ 2 minutos", que es una meta propuesta por mí y no viene del documento original)?
````

**MODELO USADO:** Sonnet 5

---

## Prompt 9

**PROMPT TITULO:** Aplicación de los 6 parches de la auditoría al PRD

**PROMPT:**
````
si aplica los 6 parches
````

**RESPUESTA CLAUDE:**
````
Los 6 parches quedaron aplicados en `docs/PRD.md`:

1. ✅ Fallback de Jira ahora distingue red caída / token inválido / ticket inexistente, y define auth vía API Token (sin OAuth/navegador).
2. ✅ Nuevo bullet de resiliencia si Ollama no está corriendo (no bloquea el flujo, marca `⚠️ Generado sin Ollama`).
3. ✅ Plantilla reestructurada en **Fase 1 / Fase 2** explícitas.
4. ✅ "Sin generación de código" reforzado para cubrir cualquier snippet, aclarando que Gherkin no es código.
5. ✅ Dos Non-Goals nuevos: sin OAuth con navegador, sin soporte multi-repo por ejecución.
6. ✅ Criterios de Éxito reemplazados por 4 métricas medibles (tiempo de arranque con meta ≤2min, cobertura de flujo en terminal, nomenclatura vía lint automático, tasa de éxito sin fallback).

Recordá que la meta de **≤ 2 minutos** en el nuevo criterio de "Tiempo de arranque del ticket" es una propuesta mía, no un dato que vino del PRD original — convendría validarla con el equipo o marcarla como provisoria antes de usarla como compromiso formal.

No toqué `002-arquitectura-del-sistema.md` ni los demás archivos derivados en `docs/` — si querés, actualizo `002` y `003` para reflejar los nuevos elementos (fallback de Ollama, autenticación por API Token, no multi-repo) que ahora sí están explícitos en el PRD.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 10

**PROMPT TITULO:** Corrección: los archivos impactados por los parches son 001 y 002, no 002 y 003

**PROMPT:**
````
el 002 y el 003? no será el 001 y el 002?
````

**RESPUESTA CLAUDE:**
````
Tenés razón — me equivoqué. Los cambios del PRD (fallback de Ollama, auth por API Token, distinción de causas de fallo de Jira, plantilla en 2 fases) impactan **001** (características) y **002** (componentes/arquitectura). El **003** (modelo de datos) no cambia: ninguno de los 6 parches agregó una entidad o atributo nuevo al esquema de SQLite.

Actualizados **001** (características principales) y **002** (componentes de arquitectura) para reflejar los 6 parches del PRD: auth por API Token, distinción de causas de fallo de Jira, resiliencia sin Ollama, restricción a un repo por ejecución, y la plantilla en dos fases. **003** quedó sin tocar, correctamente — el modelo de datos no cambió con esta auditoría.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 11

**PROMPT TITULO:** Creación del ADR-001 (arquitectura inicial): 4 decisiones de arquitectura formales

**PROMPT:**
````
Actúa como un Arquitecto de Software Principal especializado en Gobernanza Técnica y DevEx.

=== CONTEXTO ===
Estamos definiendo la arquitectura técnica para una herramienta CLI/TUI en Windows 10/11 que estandariza el inicio de tareas desde Jira, crea ramas en Git, genera carpetas locales de evidencias y utiliza Ollama para estructurar especificaciones Markdown.

=== TU MISIÓN EN ESTE TURNO ===
Evalúa críticamente el patrón arquitectónico modular propuesto (TUI Layer, Service Layer, Storage Layer) y genera un Registro de Decisiones de Arquitectura (ADR) formal en formato Markdown para guardarse en 'docs/ADR-001-arquitectura-inicial.md'.

El documento debe seguir la plantilla estándar de ADR (MADR v3.0 / Michael Nygard) e incluir explícitamente 4 registros de decisión:

1. **ADR-001.1: Interfaz CLI/TUI frente a Aplicación Gráfica (GUI/Web).**
2. **ADR-002.1: Persistencia en SQLite embebida frente a archivos planos (JSON/YAML).**
3. **ADR-003.1: LLM Local (Ollama) con Fallback Determinista frente a APIs Cloud (OpenAI/Anthropic).**
4. **ADR-004.1: Almacenamiento local de evidencias en carpeta del ticket frente a Sincronización Automática con Google Drive.**

Para CADA decisión, debes estructurar estrictamente los siguientes apartados:
- **Título y Estado:** [Aprobado]
- **Contexto y Problema:** Qué necesidad o restricción técnica motiva la decisión.
- **Opciones Consideradas:** Alternativa A (Elegida) vs Alternativa B (Descartada).
- **Criterios de Decisión:** Factores clave (rendimiento, simplicidad, costo, privacidad, mantenibilidad).
- **Decisión Elegida:** Justificación clara de por qué se tomó esa opción.
- **Consecuencias y Trade-offs:**
  - 🟢 *Consecuencias Positivas* (Lo que ganamos).
  - 🔴 *Consecuencias Negativas / Riesgos aceptados* (Lo que sacrificamos y cómo lo mitigamos).

=== RESTRICCIONES ===
- Lenguaje: Español técnico profesional.
- Tono: Analítico, objetivo y sin adornos.
- Enfócate en la justificación arquitectónica real, no en teoría genérica.
````

**RESPUESTA CLAUDE:**
````
Creé `docs/ADR-001-arquitectura-inicial.md`. Estructura del documento:

**Sección 0 — Evaluación crítica del patrón de 3 capas** (lo que pediste evaluar antes de las decisiones): concluyo que el patrón TUI/Service/Storage es válido y proporcional al alcance, pero señalo un riesgo concreto — si la Service Layer se implementa como un único método secuencial, las múltiples ramas de fallo que ya exige el PRD (Jira: red/token/404; Ollama: no disponible/timeout) se rompen entre sí. Exijo que la Service Layer se organice como un orquestador de pasos independientes, no como cambio al número de capas.

**Las 4 decisiones**, cada una con los apartados exactos que pediste (Título y Estado, Contexto y Problema, Opciones A/B, Criterios de Decisión, Decisión Elegida, Consecuencias 🟢/🔴):

- **ADR-001.1** — CLI/TUI vs GUI/Web: elegida por arranque instantáneo, cero superficie de ataque (sin servidor local), y coherencia con la decisión de no usar OAuth con navegador.
- **ADR-002.1** — SQLite vs JSON/YAML: elegida por integridad transaccional y porque el historial alimenta directamente la métrica "tasa de éxito sin fallback" del PRD, que requiere agregaciones SQL.
- **ADR-003.1** — Ollama local vs API Cloud: elegida por privacidad (texto de tickets internos no sale a terceros) y costo marginal cero a escala de 5 devs × 6 proyectos; calidad inferior aceptada y mitigada por el fallback determinista ya definido.
- **ADR-004.1** — Carpeta local vs Google Drive: elegida por reutilizar la decisión de "sin OAuth" del ADR-001.1 y reducir el alcance del MVP; riesgos de backup/acceso remoto para QA quedan aceptados y son la justificación explícita de por qué Drive va a v2.

Cada decisión está enlazada con las que la preceden (p. ej. ADR-004.1 se apoya explícitamente en ADR-001.1) para que se lea como un sistema coherente, no como 4 decisiones aisladas.

No toqué `readme.md`, `prompts.md` ni los archivos `00X-*.md` en este turno — si querés, actualizo `002-arquitectura-del-sistema.md` para enlazar/referenciar este ADR.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 12

**PROMPT TITULO:** Actualización de `002-arquitectura-del-sistema.md` con referencias al ADR-001

**PROMPT:**
````
si actualiza el archivo 002
````

**RESPUESTA CLAUDE:**
````
Actualizado `002-arquitectura-del-sistema.md`:

- **Referencia al ADR** agregada justo debajo del título de la sección.
- **2.1 Diagrama** — ya no es un `[A definir]` puro: describe las 3 capas del patrón aprobado y el ajuste del orquestador (Service Layer como pasos independientes, no monolito). Sigue faltando el diagrama visual (C4 o similar), eso queda marcado.
- **2.2 Componentes principales** — cada componente ahora indica a qué capa pertenece *(TUI Layer / Service Layer / Storage Layer)* y enlaza a la decisión del ADR que lo respalda (ADR-001.1 a 004.1). Lo que sigue sin definir es la tecnología/lenguaje concreto de implementación.
- **2.5 Seguridad** — pasó de estar totalmente vacía a reflejar las dos prácticas ya decididas por el ADR (auth sin navegador, sin exfiltración de datos a LLM cloud), dejando marcado como `[A definir]` lo que realmente no está resuelto todavía (cifrado del token en SQLite, rotación de credenciales).

No toqué 2.3 (estructura de ficheros), 2.4 (infraestructura/despliegue) ni 2.6 (tests) — el ADR no aporta información nueva para esas subsecciones, siguen como `[A definir]`.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 13

**PROMPT TITULO:** Diagramas Mermaid (componentes y secuencia), componentes detallados, estructura de ficheros y modelo de datos SQLite (Entrega 1)

**PROMPT:**
````
Actúa como un Arquitecto de Software Senior y Lead de Infraestructura/DevEx.

=== CONTEXTO DEL PROYECTO Y ARCHIVOS BASE ===
Revisa detenidamente los siguientes archivos presentes en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'docs/PRD.md')
2. 'ADR-001-arquitectura-inicial.md' (Decisiones de arquitectura aprobadas)
3. '002-arquitectura-del-sistema.md' (Plantilla/documento actual de arquitectura a completar)

=== TU MISIÓN EN ESTE TURNO ===
Basándote estrictamente en el PRD y en las decisiones registradas en el ADR-001 (patrón de 3 capas: TUI Layer, Service Layer, Storage Layer; SQLite embebida; Ollama con fallback a texto plano; evidencias locales en '/adjuntos/'), debes COMPLETAR y ACTUALIZAR el archivo '002-arquitectura-del-sistema.md' en las secciones correspondientes a la Entrega 1:

1. **Sección 2.1 — Diagrama de arquitectura (Mermaid):**
   - Diagrama de contexto/componentes en sintaxis Mermaid (`graph TD` o similar) representando las 3 capas (TUI, Services, Storage) y sus relaciones.
   - Diagrama de secuencia E2E (`sequenceDiagram`) en Mermaid detallando el flujo desde que el usuario ejecuta 'dev-tool start ID-123' hasta la creación de la rama Git, invocación de Ollama (con el flujo de fallback) y generación de carpetas/Markdown.
   - Breve justificación del patrón de 3 capas enlazando directamente con los apartados de 'ADR-001-arquitectura-inicial.md'.

2. **Sección 2.2 — Descripción de componentes principales:**
   - Explicación detallada de responsabilidades por capa y componente:
     - **TUI Layer:** Controlador de interfaz de consola Windows.
     - **Service Layer:** Jira REST Client, Ollama AI Transformer (con fallback), Git Manager, FileSystem Manager.
     - **Storage Layer:** SQLite Storage Manager y sistema de archivos local.

3. **Sección 2.3 — Descripción de alto nivel del proyecto y estructura de ficheros:**
   - Árbol de directorios representativo para el repositorio de la herramienta CLI (`/src/tui`, `/src/services`, `/src/database`, `/docs`, `/tests`, etc.).
   - Explicación breve de la responsabilidad de cada carpeta principal.

4. **Sección 3 — Modelo de Datos (SQLite):**
   - **Sección 3.1:** Diagrama ERD en sintaxis Mermaid (`erDiagram`) con entidades, claves y cardinalidades.
   - **Sección 3.2:** Sentencias DDL de SQLite (`CREATE TABLE`) y descripción detallada de atributos para las tablas: `app_config`, `projects_config` y `ticket_logs`.

=== RESTRICCIONES Y REGLAS ===
- Modifica directamente el archivo '002-arquitectura-del-sistema.md' rellenando los bloques marcados como '[A definir]' en las secciones 2.1, 2.2, 2.3 y 3.
- Mantén intacta la estructura general del archivo.
- Asegúrate de que todos los bloques de código Mermaid sean sintácticamente válidos.
- Deja indicadas como '[A definir en Entrega 2]' las secciones correspondientes a infraestructura/despliegue real, pipelines de CI/CD o ejecutables compilados.
- Lenguaje: Español técnico profesional.
````

**RESPUESTA CLAUDE:**
````
Listo. Una aclaración sobre dónde quedó cada cosa, igual que la vez pasada con el 001/002: tu instrucción decía "modifica directamente `002-arquitectura-del-sistema.md`" incluyendo ahí la "Sección 3 — Modelo de Datos", pero siguiendo la convención ya establecida en el repo, la sección 3 vive en su propio archivo `003-modelo-de-datos.md` (igual que en `readme.md`). Así quedó repartido:

**`002-arquitectura-del-sistema.md`**
- **2.1** — Diagrama de componentes (`graph TD`, 3 capas + sistemas externos) y diagrama de secuencia E2E (`sequenceDiagram`) para `devflow start ID-123`, con las dos ramas `alt/else` de fallback (Jira y Ollama) tal como quedaron aprobadas en el PRD/ADR. Justificación enlazando cada tramo del diagrama con el ADR correspondiente.
- **2.2** — Reestructurada por capa con los nombres exactos que pediste: *Controlador de consola* (TUI), *Jira REST Client / Ollama AI Transformer / Git Manager / FileSystem Manager* (Service Layer, con el Orquestador como coordinador), *SQLite Storage Manager* + sistema de archivos (Storage Layer).
- **2.3** — Árbol de directorios (`/src/tui`, `/src/services/{jira,ollama,git,filesystem}`, `/src/database`, `/docs`, `/tests`, etc.) con tabla de responsabilidad por carpeta. Nota explícita: las extensiones `.ts` son ilustrativas, el lenguaje/runtime sigue sin decidirse.
- **2.4** — Marcada como `[A definir en Entrega 2]`, tal como pediste.

**`003-modelo-de-datos.md`**
- **3.1** — ERD en `erDiagram` con `APP_CONFIG`, `PROJECTS_CONFIG`, `TICKET_LOGS` y la cardinalidad `PROJECTS_CONFIG ||--o{ TICKET_LOGS`.
- **3.2** — Tablas de atributos + DDL completo (`CREATE TABLE`, `CHECK`, `UNIQUE`, `FK`, índices) para las 3 tablas pedidas.

Todos los diagramas Mermaid usan sintaxis válida (`graph TD` con subgrafos y `classDef`, `sequenceDiagram` con `alt/else/end` balanceados, `erDiagram` con atributos tipados). No toqué `2.5` ni `2.6` (seguían fuera del alcance pedido) ni `readme.md`/`prompts.md`.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 14

**PROMPT TITULO:** ADR-005.1 — Integración directa con Jira REST API frente a consumo vía MCP Server (Atlassian Rovo)

**PROMPT:**
````
Actúa como un Arquitecto de Software Senior y Lead de Infraestructura/DevEx.

=== CONTEXTO ===
Estamos evaluando la estrategia de integración con Jira para la herramienta 'DevFlow CLI' (Windows 10/11).
Debemos documentar la decisión técnica de usar un 'Jira REST Client' directo (HTTP + API Token) frente a la alternativa de consumir la API a través de un 'MCP Server' (Model Context Protocol como Atlassian Rovo MCP).

=== TU MISIÓN EN ESTE TURNO ===
1. Actualiza el archivo 'docs/ADR-001-arquitectura-inicial.md' añadiendo una sub-sección o registro explícito 'ADR-005.1: Integración directa con Jira REST API frente a consumo vía MCP Server'.
2. Justifica por qué se elige el cliente REST HTTP directo para el MVP:
   - **Garantía de autonomía y resiliencia:** Evita flujos de autenticación OAuth2 con navegador que introducen fricción y violan los Non-Goals del PRD.
   - **Rendimiento y determinismo:** Control preciso de timeouts y disparadores del modo fallback manual (HTTP 401, 403, 404).
   - **Eficiencia de tokens:** El cliente REST parsea JSON directamente sin consumir presupuesto de contexto de un LLM.
3. Actualiza el componente 'Módulo de integración con Jira' en '002-arquitectura-del-sistema.md' reflejando esta decisión.

=== RESTRICCIONES ===
- Utiliza la plantilla estándar de ADR (MADR v3.0) con Contexto, Opciones Consideradas, Decisión y Consecuencias (Pros/Cons).
- Lenguaje: Español técnico profesional.
````

**RESPUESTA CLAUDE:**
````
Aplicado en ambos archivos:

**`docs/ADR-001-arquitectura-inicial.md`** — nuevo registro **ADR-005.1** al final del documento, con la misma plantilla que los otros 4 (Título/Estado, Contexto y Problema, Opciones A/B, Criterios de Decisión, Decisión Elegida, Consecuencias 🟢/🔴), justificando el cliente REST directo con los tres argumentos pedidos:

- **Autonomía y resiliencia:** un MCP Server como Rovo suele requerir OAuth2 con navegador — el mismo componente ya vetado en ADR-001.1 — y añade un proceso externo como punto de fallo adicional.
- **Rendimiento y determinismo:** el cliente REST directo controla en una sola capa la distinción 401/403/404/timeout que exige el fallback manual del PRD; un MCP intermedio no garantiza ese control.
- **Eficiencia de tokens:** parsear JSON de Jira es mecánico y no necesita presupuesto de contexto de un LLM, a diferencia de una operación pensada para ser consumida por un agente.

También dejé explícito el trade-off aceptado (el equipo mantiene el cliente REST ante cambios de la API de Jira, en vez de que un MCP oficial lo absorba) y la puerta abierta a reevaluar MCP si el ecosistema resuelve la autenticación sin navegador.

**`docs/002-arquitectura-del-sistema.md`** — el componente **Jira REST Client** (§2.2, Service Layer) ahora dice explícitamente que consulta la API de Jira de forma directa, sin MCP Server intermedio, y enlaza tanto a ADR-001.1 como al nuevo ADR-005.1.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 15

**PROMPT TITULO:** Auditoría exhaustiva de la Sección 2.2 (componentes) de la arquitectura: contratos, errores, DI y Single Responsibility

**PROMPT:**
````
Actúa como un Arquitecto de Software Principal y Auditor Técnico especializado en Sistemas Modulares y DevEx.

=== CONTEXTO DEL PROYECTO Y ARCHIVOS DE REFERENCIA ===
Revisa los siguientes archivos en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'PRD.md')
2. 'ADR-001-arquitectura-inicial.md'
3. '002-arquitectura-del-sistema.md' (Enfócate específicamente en la Sección 2.2: "Descripción de componentes principales")

=== TU MISIÓN EN ESTE TURNO ===
Audita de manera crítica y exhaustiva la **Sección 2.2 (Descripción de componentes principales)** de '002-arquitectura-del-sistema.md'. Tu objetivo es encontrar vacíos de definición técnica, ambigüedades en las responsabilidades de cada módulo y falta de contratos/interfaces entre capas.

Para cumplir tu misión, realiza las siguientes tareas:

1. **Auditoría Componente por Componente:**
   Analiza cada uno de los componentes de las 3 capas:
   - **Capa TUI (Presentación):** Controller/View de la terminal, captura de inputs, renderizado de estados/spinners.
   - **Capa de Servicios (Negocio e Integraciones):** Jira REST Client, Ollama AI Transformer (con fallback), Git Manager, FileSystem Manager.
   - **Capa de Persistencia:** SQLite Storage Manager y Local File System Storage.

2. **Identificación de Gaps y Definiciones Faltantes:**
   Detecta qué falta especificar en el documento. Pon especial atención a:
   - **Contratos e Interfaces:** ¿Está claro cómo se comunican las capas entre sí (DTOs, eventos, llamadas directas)?
   - **Manejo de Errores y Resiliencia:** ¿Cada componente define cómo reaccionar ante fallos de sus dependencias (ej. tiempo de timeout de Jira/Ollama, repositorios Git bloqueados)?
   - **Inyección de Dependencias y Configuración:** ¿Cómo recibe cada servicio sus parámetros (rutas, tokens, conexión a SQLite)?
   - **Límites de Responsabilidad (*Single Responsibility*):** ¿Hay algún componente asumiendo tareas que corresponden a otra capa?

3. **Matriz de Opciones y Alternativas:**
   Por CADA punto ciego o definición faltante que encuentres, presenta entre 2 y 3 opciones técnicas claras para resolverlo.
   Estructura las opciones indicando:
   - **Opción A / Opción B / Opción C**
   - 🟢 *Ventajas / Pros*
   - 🔴 *Desventajas / Trade-offs*
   - 💡 *Recomendación sugerida*

=== FORMATO DE RESPUESTA ===
Estructura tu reporte así:
1. 🔍 **Diagnóstico General de la Sección 2.2**
2. 🚨 **Gaps y Definiciones Faltantes Identificadas** (Agrupados por componente)
3. 🛠️ **Opciones de Solución y Decisiones Pendientes** (Con pros/contras para que yo pueda elegir)
4. 📝 **Propuesta de Parche/Redacción** (Una vez elegidas las opciones, cómo quedaría el texto mejorado para '002-arquitectura-del-sistema.md')
````

**RESPUESTA CLAUDE:**
````
# 🔍 1. Diagnóstico General de la Sección 2.2

La sección 2.2 hace un buen trabajo **nombrando** los componentes correctos por capa y **enlazándolos** a las decisiones del ADR-001/005, pero se queda en el nivel de "qué hace cada uno en una frase" sin bajar al nivel de **contrato**. Concretamente:

- Define bien el **enum de resultado** (`Ok | FallbackManual | FallbackDeterminista`) pero solo cubre **dos** categorías de fallo (Jira, Ollama). Todo lo demás (Git bloqueado, permisos de disco, SQLite concurrente) no tiene dónde caer en ese contrato — hoy son fallos "huérfanos".
- El propio **diagrama de componentes de §2.1** contradice el texto de §2.2: el diagrama dibuja `JIRA --> SQLITE`, `OLLAMA --> SQLITE`, `GITM --> SQLITE` (cada integración escribiendo directo a SQLite), mientras que el texto de §2.2 sugiere que el historial es una responsabilidad centralizada del `SQLite Storage Manager`. Esto es una violación de *Single Responsibility* sin resolver: **¿quién decide qué se escribe en `ticket_logs`?**
- No hay ningún componente con un contrato de **inyección de dependencias** explícito (cómo llega `jira_api_token`, `ollama_host`, la ruta del repo, etc. a cada uno).
- Dos componentes (**FileSystem Manager** en Service Layer y **Sistema de archivos local** en Storage Layer) tienen una frontera de responsabilidad borrosa — ambos "tocan disco", y hoy no está claro dónde termina la lógica de negocio y dónde empieza el acceso técnico.
- El manejo de errores está resuelto para los **caminos felices de fallback ya decididos** (Jira/Ollama), pero no para los casos operativos reales de un entorno Windows con Git: working directory sucio, `.git/index.lock`, permisos denegados, rutas de red/OneDrive.

En resumen: **la sección responde "qué" pero no "cómo se comunican" ni "qué pasa cuando algo no encaja en el guion feliz".**

---

# 🚨 2. Gaps y Definiciones Faltantes (agrupados por componente)

### TUI Layer — Controlador de consola
- **[G1]** No se define si la comunicación TUI↔Orquestador es síncrona (bloqueante) o basada en eventos/callbacks — crítico porque Jira/Ollama pueden tardar varios segundos y el spinner necesita actualizarse en vivo.
- **[G2]** No se define qué pasa ante cancelación (Ctrl+C) a mitad de flujo — ¿rollback de rama/carpetas ya creadas, o se dejan a medio hacer?
- **[G3]** No se define dónde vive la validación de formato del ID de ticket (¿TUI o Orquestador?).

### Service Layer — Orquestador de Ticket
- **[G4]** Falta una tercera categoría de resultado para fallos que **no son** `FallbackManual` ni `FallbackDeterminista` (ej. Git bloqueado, sin permisos de escritura) — hoy no tienen dónde caer.
- **[G5]** No se define si el flujo es transaccional ("todo o nada") o de mejor esfuerzo — si falla la escritura del documento después de crear rama+carpetas, ¿queda el sistema inconsistente?
- **[G6]** El "reprocesar más tarde" que promete el ADR-003.1 cuando Ollama cae en fallback no tiene dueño: ¿es un comando nuevo (`devflow reprocess ID-123`) del Orquestador, o queda fuera del MVP?

### Service Layer — Jira REST Client
- **[G7]** El modelo de datos (`003-modelo-de-datos.md`) tiene `ollama_timeout_seconds` pero **no** un `jira_timeout_seconds` equivalente — inconsistencia entre el esquema ya aprobado y lo que describe 2.2.
- **[G8]** No se define política de reintentos ante timeout transitorio, ni manejo de `429 Too Many Requests` (rate limiting de Jira Cloud) — hoy solo se contemplan 401/403/404/timeout.
- **[G9]** No se especifica el mecanismo de inyección de configuración (token, base URL) — ¿constructor injection desde `SQLite Storage Manager`, o el Orquestador se los pasa ya resueltos?

### Service Layer — Ollama AI Transformer
- **[G10]** No se define el contrato del prompt/respuesta esperado del modelo (¿Markdown libre o JSON estructurado que luego se transforma?) — esto es relevante porque el PRD exige "cero código generado", y sin un contrato de salida no hay forma de **validar/sanitizar** una respuesta antes de escribirla.
- **[G11]** No se distingue "timeout" de "no disponible" — ¿hay health-check previo, o se intenta directo y se interpreta el tipo de excepción?
- **[G12]** No se define qué pasa si Ollama responde **a tiempo** pero con contenido mal formado (Gherkin roto) — ¿cuenta como éxito igual, o dispara el mismo fallback determinista por "calidad insuficiente"?

### Service Layer — Git Manager
- **[G13]** "Detecta y reporta rama ya existente" no dice **cómo** — ¿hace checkout de la existente, aborta, o pregunta al usuario? Y si pregunta, ¿por qué canal (esto tocaría a la TUI, no a Git Manager)?
- **[G14]** No valida el estado del working directory antes de branchear — riesgo real de mezclar cambios sin commitear de un ticket anterior con el nuevo.
- **[G15]** No se especifica si actualiza (`fetch`/`pull`) la rama base (`default_base_branch` de `projects_config`) antes de crear la nueva rama — riesgo de ramas desactualizadas.
- **[G16]** No contempla el caso explícito que pediste auditar: **repositorio bloqueado** (`.git/index.lock` de otro proceso Git corriendo en paralelo).

### Service Layer — FileSystem Manager
- **[G17]** No define idempotencia: si el ticket ya fue iniciado antes (carpeta/documento ya existen), ¿sobrescribe, falla o pregunta? Riesgo real de **perder contenido de Fase 2** ya completado por el desarrollador.
- **[G18]** No aclara si `/ticket-ID/adjuntos/` vive **dentro** del repositorio versionado por Git o **fuera**, en una carpeta de trabajo separada — con implicancias directas de si las evidencias terminan commiteadas sin querer.
- **[G19]** No contempla fallo de permisos de escritura (carpeta sincronizada por OneDrive bloqueada, ruta de red) como un tercer tipo de error.

### Storage Layer — SQLite Storage Manager
- **[G20]** No define modo de concurrencia (WAL vs. journal por defecto) — relevante si el desarrollador corre dos terminales a la vez.
- **[G21]** No define la ubicación concreta del archivo `.db` en Windows (¿`%APPDATA%\DevFlowCLI\`?).
- **[G22]** No define el mecanismo de migraciones (la carpeta `migrations/` existe en §2.3 pero no se describe cómo/cuándo se aplican).
- **[G23]** *(el más importante — Single Responsibility)*: el diagrama de §2.1 dibuja a Jira/Ollama/Git escribiendo **directo** a SQLite; el texto de §2.2 sugiere que el historial es responsabilidad centralizada. Hay que decidir una sola fuente de verdad.

### Storage Layer — Sistema de archivos local
- **[G24]** Solapamiento de responsabilidad con **FileSystem Manager** (Service Layer): ambos "escriben a disco" y no está claro dónde termina la decisión de negocio (qué escribir, con qué plantilla) y dónde empieza el acceso técnico (cómo escribir bytes).

---

# 🛠️ 3. Opciones de Solución y Decisiones Pendientes

### Decisión 1 — Comunicación TUI ↔ Orquestador (cubre G1, G2, G3)
- **Opción A — Llamada síncrona simple** (`orchestrator.iniciarTicket(id): ResultadoFinal`).
  🟢 Trivial de implementar y testear. 🔴 Sin progreso en vivo: la TUI queda "congelada" mientras Ollama procesa (varios segundos).
- **Opción B — Callbacks/eventos de progreso** (`onStep(nombrePaso, estado)` emitido por cada paso del orquestador).
  🟢 Permite spinners y feedback en tiempo real, mejor DevEx. 🔴 Más complejidad de implementación y de testing (mocks de eventos).
- **Opción C — Cola de mensajes/Observer pattern desacoplado.**
  🟢 Máximo desacople. 🔴 Sobre-ingeniería para un CLI de un solo proceso.
- 💡 **Recomendación:** Opción B. El propio diagrama de secuencia ya implica pasos secuenciales largos (Jira, Ollama) — sin progreso visible, la herramienta se sentiría "colgada", contradiciendo el objetivo de DevEx del PRD.

### Decisión 2 — Tercera categoría de resultado para fallos no contemplados (cubre G4, G16, G19)
- **Opción A — Extender el enum a `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.**
  🟢 Un solo contrato para todo el sistema, fácil de razonar. 🔴 `ErrorBloqueante` es genérico; puede terminar siendo un cajón de sastre.
- **Opción B — Tipo de error jerárquico** (`ErrorBloqueante` con subtipos: `RepositorioBloqueado`, `PermisosInsuficientes`, `EstadoInvalido`).
  🟢 Más preciso para logging/QA y para decidir el mensaje exacto en la TUI. 🔴 Más tipos que mantener.
- 💡 **Recomendación:** Opción B, pero solo con 2-3 subtipos iniciales (no más) — da precisión sin sobre-modelar en el MVP.

### Decisión 3 — Inyección de dependencias/configuración (cubre G9, G10-parcial)
- **Opción A — El Orquestador lee toda la config una vez de `SQLite Storage Manager` al arrancar y la inyecta por constructor a cada componente.**
  🟢 Un único punto de lectura, fácil de mockear en tests (se inyecta un objeto de config plano). 🔴 El Orquestador conoce la forma de la config de cada componente (acoplamiento leve).
- **Opción B — Cada componente recibe una referencia al `SQLite Storage Manager` y lee su propia config bajo demanda.**
  🟢 Cada componente es autónomo. 🔴 Múltiples lecturas a SQLite dispersas; más difícil de testear sin levantar una DB real o mockear el manager en cada test.
- 💡 **Recomendación:** Opción A (constructor injection con config resuelta una vez) — es el patrón estándar para testabilidad y evita que 4 componentes distintos sepan leer SQLite.

### Decisión 4 — Ubicación y responsabilidad de la escritura en `ticket_logs` (cubre G23 — el gap más crítico)
- **Opción A — Escritura centralizada: solo el Orquestador escribe en `ticket_logs`, al final del flujo, con el resultado agregado de todos los pasos.**
  🟢 Una sola fuente de verdad, resuelve la contradicción con el diagrama. 🔴 Si el proceso crashea a mitad de flujo, no queda ni rastro en el historial de ese intento.
- **Opción B — Cada integración (Jira/Git/Ollama) escribe su propio resultado parcial en cuanto termina (como sugiere hoy el diagrama).**
  🟢 Historial más granular y resiliente a crashes parciales. 🔴 Rompe *Single Responsibility*: 4 componentes distintos necesitan saber el esquema de `ticket_logs`.
- 💡 **Recomendación:** Opción A. Es más simple, consistente con "orquestador como único responsable de estado agregado", y el `SQLite Storage Manager` se mantiene como único punto de acceso a la Storage Layer — **hay que corregir el diagrama de §2.1** para que solo `ORCH --> SQLITE` exista (eliminar las flechas `JIRA/OLLAMA/GITM --> SQLITE`).

### Decisión 5 — Ubicación de `/ticket-ID/adjuntos/` respecto al repositorio Git (cubre G18)
- **Opción A — Dentro del repositorio** (`<repo>/ticket-ID/adjuntos/`), con `.gitignore` para evitar commitear adjuntos por accidente.
  🟢 QA lo encuentra sin salir del repo. 🔴 Riesgo de que alguien fuerce el `git add` de adjuntos pesados; depende de que el `.gitignore` esté bien configurado.
- **Opción B — Fuera del repositorio**, en una carpeta de trabajo separada del usuario (ej. `%USERPROFILE%\DevFlowCLI\tickets\ID-123\`).
  🟢 Cero riesgo de contaminar el repo con binarios/evidencias. 🔴 QA necesita conocer una ruta adicional fuera del código; más difícil de "descubrir".
- 💡 **Recomendación:** Opción B. Las evidencias de prueba no son código y el PRD ya asume acceso local del equipo a la máquina/red del desarrollador (lo dijo el propio ADR-004.1 al aceptar ese trade-off) — mantenerlas fuera del repo evita ensuciar el historial de Git del proyecto.

### Decisión 6 — Idempotencia del FileSystem Manager (cubre G17)
- **Opción A — Nunca sobrescribe:** si la carpeta/documento ya existen, aborta con error y pide al desarrollador un comando explícito de "forzar".
  🟢 Cero riesgo de pérdida de datos. 🔴 Fricción si el desarrollador solo quería reintentar tras un fallback.
- **Opción B — Sobrescribe solo la Fase 1 (auto-generada), preservando siempre la Fase 2 (contenido manual del desarrollador).**
  🟢 Permite reprocesar con Ollama sin perder trabajo manual — resuelve también el gap G6 (reprocesamiento). 🔴 Requiere que el documento tenga marcadores claros de dónde empieza/termina cada fase (parseable).
- 💡 **Recomendación:** Opción B — además de resolver G17, es la base técnica para cumplir la promesa de "reprocesar más tarde" del ADR-003.1 (G6).

### Decisión 7 — Pre-chequeos del Git Manager antes de branchear (cubre G13, G14, G15)
- **Opción A — Chequeos mínimos:** solo verifica que el repo exista y que la rama no esté duplicada.
  🟢 Simple. 🔴 No resuelve el escenario real de "repo bloqueado" ni working directory sucio que pediste auditar explícitamente.
- **Opción B — Pre-flight completo:** verifica repo válido, working directory limpio, `fetch` de la rama base, ausencia de `.git/index.lock`, y solo entonces crea la rama — cualquier chequeo fallido retorna `ErrorBloqueante` (Decisión 2) con el subtipo correspondiente.
  🟢 Cubre los escenarios reales de un equipo de 5 devs en 6 repos. 🔴 Más lento (un `git fetch` de red antes de cada ticket) y más superficie de fallo a manejar.
- 💡 **Recomendación:** Opción B — es exactamente lo que la consigna pidió auditar ("repositorios Git bloqueados"), y dejarlo fuera del MVP sería repetir el mismo tipo de punto ciego que ya corregimos en el PRD para Jira/Ollama.

### Decisión 8 — Contrato de salida del Ollama AI Transformer (cubre G10, G11, G12)
- **Opción A — El modelo devuelve Markdown libre; se usa tal cual.**
  🟢 Prompt más simple. 🔴 Sin forma de validar que no "se coló" un bloque de código (riesgo directo contra el Non-Goal del PRD) ni de detectar Gherkin mal formado.
- **Opción B — El modelo devuelve JSON estructurado (`{contexto, casosDeUso, gherkin}`) validado contra un schema antes de renderizar a Markdown; si no valida, se trata como `FallbackDeterminista`.**
  🟢 Permite sanitizar (rechazar bloques ```code```) y validar forma antes de persistir — cierra el gap G12 de calidad. 🔴 Modelos locales pequeños son menos confiables generando JSON válido; puede aumentar la tasa de fallback.
- 💡 **Recomendación:** Opción B — es la única que realmente hace cumplible, en código, la garantía "cero código generado" que el PRD y el ADR-001 ya prometieron por escrito.

### Decisión 9 — Frontera entre FileSystem Manager y "Sistema de archivos local" (cubre G24)
- **Opción A — Fusionar en un solo componente** (`FileSystem Manager`, en Service Layer), eliminando "Sistema de archivos local" como entidad separada de Storage Layer.
  🟢 Elimina la ambigüedad de raíz. 🔴 La Storage Layer queda representada solo por SQLite, un poco asimétrica en el diagrama.
- **Opción B — Mantener dos capas: `FileSystem Manager` (Service Layer) decide **qué** escribir y en qué ruta; delega la escritura física de bytes a un `Local File Storage` (Storage Layer) que no conoce el dominio (solo `write(path, content)`).
  🟢 Respeta la separación TUI/Service/Storage de forma estricta y simétrica con SQLite. 🔴 Una capa de indirección extra para una operación simple.
- 💡 **Recomendación:** Opción B — mantiene la simetría del patrón de 3 capas aprobado en el ADR-001 (ninguna capa de negocio toca I/O crudo directamente) sin agregar complejidad real.

### Decisión 10 — Timeout/reintentos/rate-limit de Jira (cubre G7, G8)
- **Opción A — Sin reintentos:** un solo intento, timeout fijo, cualquier fallo (incluido 429) cae a `FallbackManual`.
  🟢 Simple, predecible. 🔴 Un timeout transitorio de red (típico en VPN corporativa) fuerza carga manual innecesariamente.
- **Opción B — Un reintento único con backoff corto (ej. 1 retry tras 2s) antes de declarar fallo; 429 se trata con `Retry-After` si el header existe, si no, igual que timeout.**
  🟢 Reduce fallbacks manuales innecesarios por blips de red. 🔴 Duplica el tiempo máximo de espera en el peor caso.
- 💡 **Recomendación:** Opción B, y agregar `jira_timeout_seconds` a `app_config` en `003-modelo-de-datos.md` para que sea simétrico con `ollama_timeout_seconds` (corrige G7).

---

# 📝 4. Propuesta de Parche de Redacción para §2.2

Aplicando las recomendaciones marcadas con 💡 arriba (ajustable si preferís otra opción en cualquier decisión):

```markdown
### **2.2. Descripción de componentes principales:**

El PRD (sección "Alcance del MVP") y el ADR-001/005 definen los siguientes componentes funcionales, agrupados por capa. La comunicación entre capas sigue un contrato único de resultado por paso — `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante` — y toda configuración (tokens, rutas, timeouts) se resuelve una única vez al arrancar y se inyecta por constructor a cada componente, nunca leída ad-hoc por cada uno desde SQLite.

**TUI Layer**

- **Controlador de interfaz de consola (Windows):** único punto de entrada del usuario (`devflow start <ID>`). Se comunica con el Orquestador mediante eventos de progreso (`onStep(paso, estado)`), no una llamada bloqueante única, para poder renderizar spinners durante operaciones largas (Jira, Ollama). Valida el formato del ID de ticket antes de invocar al Orquestador. Ante `Ctrl+C`, señala cancelación al Orquestador, que decide si revertir pasos ya aplicados (ver Orquestador de Ticket). Nunca accede directamente a la Storage Layer ni a servicios externos. Decisión: [ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb).

**Service Layer** *(orquestador de pasos independientes — ver [ADR-001, §0](ADR-001-arquitectura-inicial.md#0-evaluación-del-patrón-arquitectónico-modular-propuesto-tui-layer--service-layer--storage-layer))*

- **Orquestador de Ticket:** coordina la secuencia Jira → Git → FileSystem → Ollama → FileSystem(documento) emitiendo un evento de progreso por paso. Es el **único** componente que escribe en `ticket_logs` (al finalizar, con el resultado agregado), evitando que Jira/Git/Ollama conozcan el esquema de persistencia. Ante `ErrorBloqueante` de cualquier paso, detiene el flujo y reporta a la TUI qué se alcanzó a crear (rama/carpetas) para que el desarrollador decida cómo continuar manualmente — no revierte automáticamente cambios ya aplicados en Git.
- **Jira REST Client:** consulta directamente los endpoints REST de Jira (`GET /rest/api/*/issue/{id}`) — sin MCP Server intermedio ([ADR-005.1](ADR-001-arquitectura-inicial.md#adr-0051-integración-directa-con-jira-rest-api-frente-a-consumo-vía-mcp-server)) —, autenticado con API Token/PAT ([ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb)). Aplica un reintento único con backoff corto ante timeout antes de declarar `FallbackManual`; clasifica también `429 Too Many Requests` como causa de fallback. Recibe `jira_base_url`, `jira_api_token` y `jira_timeout_seconds` por constructor, resueltos por el Orquestador desde `app_config`.
- **Ollama AI Transformer (con Fallback):** invoca el modelo local esperando una respuesta en **JSON estructurado** (`{contexto, casosDeUso, gherkin}`), validada contra un schema antes de renderizarse a Markdown; una respuesta que no valida (JSON inválido, o que contenga bloques de código) se trata como `FallbackDeterminista`, igual que un timeout o servicio no disponible. Decisión: [ADR-003.1](ADR-001-arquitectura-inicial.md#adr-0031-llm-local-ollama-con-fallback-determinista-frente-a-apis-cloud-openaianthropic).
- **Git Manager:** antes de crear la rama, ejecuta un pre-flight: repositorio válido, working directory limpio, `fetch` de `default_base_branch` (tabla `projects_config`), y ausencia de bloqueo (`.git/index.lock`); cualquier chequeo fallido retorna `ErrorBloqueante` con subtipo (`RepositorioBloqueado`, `CambiosSinCommitear`, `RamaYaExiste`) para que la TUI muestre el mensaje correspondiente — Git Manager nunca decide el mensaje ni pregunta directamente al usuario.
- **FileSystem Manager:** crea `/ticket-ID/adjuntos/` **fuera** del repositorio versionado (ruta de trabajo del usuario, no trackeada por Git) y escribe el documento en dos fases delimitadas por marcadores parseables. Es **idempotente para la Fase 1**: una reejecución (p. ej. reprocesar tras un `FallbackDeterminista` de Ollama) puede regenerar solo esa fase sin tocar el contenido de Fase 2 ya completado por el desarrollador. Delega la escritura física de bytes al `Local File Storage` de la Storage Layer. Decisión: [ADR-004.1](ADR-001-arquitectura-inicial.md#adr-0041-almacenamiento-local-de-evidencias-en-carpeta-del-ticket-frente-a-sincronización-automática-con-google-drive).

**Storage Layer**

- **SQLite Storage Manager:** único componente con acceso de escritura a `app_config`, `projects_config` y `ticket_logs`; nadie más en el sistema conoce su esquema (corrige la inconsistencia previa del diagrama de §2.1, donde Jira/Ollama/Git escribían directamente — ese acceso queda eliminado). Opera en modo WAL para tolerar el caso de dos ejecuciones concurrentes del CLI; el archivo vive en `%APPDATA%\DevFlowCLI\devflow.db`. Aplica migraciones versionadas al arrancar (ver `src/database/migrations/`). Decisión: [ADR-002.1](ADR-001-arquitectura-inicial.md#adr-0021-persistencia-en-sqlite-embebida-frente-a-archivos-planos-jsonyaml).
- **Local File Storage:** capa de acceso a disco sin conocimiento de dominio (`write(path, content)`, `exists(path)`); el `FileSystem Manager` de la Service Layer es quien decide qué escribir, con qué plantilla y en qué ruta.

[A definir] — tecnología/lenguaje concreto de implementación de cada componente, y la forma exacta (tipos/schema) de `ContextoTicket` y del JSON esperado de Ollama.
```

**Cambio adicional necesario, fuera de §2.2:**
- Corregir el **diagrama de componentes de §2.1** eliminando las flechas `JIRA --> SQLITE`, `OLLAMA --> SQLITE`, `GITM --> SQLITE` (solo `ORCH --> SQLITE` debe quedar), para que el diagrama deje de contradecir el texto.
- Agregar `jira_timeout_seconds` a la tabla `app_config` en `003-modelo-de-datos.md` (hoy solo existe `ollama_timeout_seconds`).

¿Aplico este parche tal cual (con las 10 recomendaciones 💡), o preferís que ajuste alguna de las decisiones antes de escribirlo en `002-arquitectura-del-sistema.md` y `003-modelo-de-datos.md`?
````

**MODELO USADO:** Sonnet 5

---

## Prompt 16

**PROMPT TITULO:** Ajuste de la Decisión 7 — validación mínima del Git Manager (solo repo existente + rama no duplicada)

**PROMPT:**
````
en cuanto a decision 7, solo es necesario chequear que exista el repositorio y que no exista la rama, no necesito auditoria en eso, solo podemos marcar que rama se creo, si se creo y nada mas. cualquier problema, lo tendrá que manejar el desarrollador
````

**RESPUESTA CLAUDE:**
````
Actualizado. El Git Manager en `002-arquitectura-del-sistema.md` ahora deja explícito el alcance mínimo que pediste:

- Solo verifica **(a)** que el repositorio exista y **(b)** que la rama no exista ya.
- Reporta únicamente: rama creada (con su nombre) o no creada porque ya existía.
- Explícitamente **no** hace pre-flight de working directory, `fetch`/`pull`, ni detección de locks — y queda documentado que cualquier otro problema de Git es responsabilidad del desarrollador, fuera del alcance de la herramienta.

Con esto, la **Decisión 7** de la auditoría queda cerrada con la **Opción A** (mínima), no la B que yo había recomendado. Siguen pendientes de tu decisión las Decisiones 1, 2, 3, 4, 6, 8, 9 y 10.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 17

**PROMPT TITULO:** Ajuste del FileSystem Manager — el repositorio del proyecto no se modifica; en Git solo se crea la rama

**PROMPT:**
````
necesito que ajustes la seccion de FileSystem Manager y dejar en claro que en el repositorio del proyecto donde se hace el desarrollo NO SE MODIFICA, por lo tanto no se sube nada al Git. En git solo se crea la rama, no más que eso. Los directorios que se crearan desde DevFlow CLI seran solamente en windows en la pc del desarrollador
````

**RESPUESTA CLAUDE:**
````
Ajustado en `002-arquitectura-del-sistema.md`:

- **Git Manager:** ahora dice explícitamente que su única escritura sobre el repositorio del proyecto es la creación de la rama — sin `commit`, sin `add`, sin `push`, sin tocar ningún archivo trackeado. El código del proyecto queda intacto.
- **FileSystem Manager:** ahora aclara que la carpeta `/ticket-ID/adjuntos/` y el documento Markdown se crean **enteramente fuera del repositorio Git**, en una ruta separada de la PC Windows del desarrollador (ejemplo: `%USERPROFILE%\DevFlowCLI\tickets\ID-123\`) — no dentro de `<repo>\...`. Se deja explícito que este componente no interactúa con Git en absoluto, y que la persistencia es 100% local a la máquina Windows, sin sincronización remota en el MVP.

Esto además resuelve de forma definitiva la **Decisión 5** que había quedado abierta en la auditoría anterior (ubicación de `/adjuntos/` dentro o fuera del repo) — quedó fijada la opción "fuera del repo". El resto de las recomendaciones de esa auditoría (Decisiones 1, 2, 3, 4, 6-10) siguen pendientes de tu confirmación antes de aplicarlas.
````

**MODELO USADO:** Sonnet 5

---

## Prompt 18

**PROMPT TITULO:** Aplicación de las decisiones pendientes de la auditoría (1, 2, 3, 4, 6, 8, 9, 10) con las opciones recomendadas

**PROMPT:**
````
para las decisiones pendientes toma las recomendadas
````

**RESPUESTA CLAUDE:**
````
Listo. Apliqué las 8 decisiones recomendadas (1, 2, 3, 4, 6, 8, 9, 10) sobre `002-arquitectura-del-sistema.md` y `003-modelo-de-datos.md`:

| # | Decisión | Cambio aplicado |
|---|---|---|
| **1** | TUI ↔ Orquestador | Controlador de consola ahora se comunica por **eventos de progreso** (`onStep`), no llamada bloqueante — spinners en vivo. |
| **2** | Tipo de error faltante | Contrato extendido a `Ok \| FallbackManual \| FallbackDeterminista \| ErrorBloqueante`, actualizado en el resumen de capas, la justificación del ADR y el Orquestador. |
| **3** | Inyección de dependencias | Nuevo párrafo: config se resuelve una vez y se inyecta por constructor; ningún componente de integración lee SQLite por su cuenta. |
| **4** | Dueño de `ticket_logs` | Diagrama de componentes corregido (solo `ORCH --> SQLITE`, se eliminaron las flechas de Jira/Ollama/Git); nota explícita de que el Orquestador es el único escritor; `SQLite Storage Manager` redactado como único punto de acceso. |
| **6** | Idempotencia FileSystem Manager | Ahora regenera solo Fase 1 en reprocesos, preservando siempre la Fase 2 ya completada por el dev. |
| **8** | Contrato de salida de Ollama | Ahora exige JSON estructurado validado contra schema; si no valida (incluye código, mal formado, campos faltantes) cae a `FallbackDeterminista`. |
| **9** | Frontera FileSystem Manager / disco | Renombrado a **Local File Storage** (Storage Layer, I/O puro `write`/`exists`); FileSystem Manager decide qué escribir y delega la escritura física. |
| **10** | Timeout/retry de Jira | Un reintento con backoff corto + manejo de `429`/`Retry-After`; agregado `jira_timeout_seconds` a `app_config` en ERD, tabla de atributos y DDL de `003-modelo-de-datos.md`. |

Las **Decisiones 5 y 7** ya habían quedado cerradas en los turnos anteriores (carpeta fuera del repo / validación mínima de Git), así que con esto las 10 quedan resueltas.
````

**MODELO USADO:** Sonnet 5

---

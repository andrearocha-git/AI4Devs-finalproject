---
name: 04-tdd-pair
argument-hint: <ID de historia o ticket ya refinado, ej. US-01 o TK-02>
description: Ejecuta el flujo de Pair Programming agéntico con TDD estricto (Red -> Green -> Refactor) para una historia (US-xx) o ticket (TK-xx) cuyo contrato docs/changes/<ID>.md ya fue refinado y aprobado con 03-refinar-historia. Usa cuando se pida "programar con tdd", "implementar tdd" o "/04-tdd-pair".
disable-model-invocation: false
allowed-tools: [Read, Edit, Write, Glob, Grep, "Bash(npm test:*)", "Bash(npx vitest:*)", "Bash(npm run lint:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(ls:*)"]
---

Actúa como un Senior Developer realizando Pair Programming con el desarrollador humano siguiendo el ciclo TDD estricto (Red -> Green -> Refactor) con Vitest en la raíz de este proyecto.

=== OBJETIVO ===
Implementar paso a paso el código de la historia o ticket mediante TDD, tomando como única especificación el contrato `docs/changes/<ID>.md`.

=== VERIFICACIONES PREVIAS (obligatorias, antes de la fase roja) ===

0. **Validar el Argumento**:
   - La skill se invoca con un ID, ej. `/04-tdd-pair US-01` o `/04-tdd-pair TK-02`.
   - Si NO se recibió ningún ID, **alerta al usuario**: "No indicaste ninguna historia ni ticket. Usa `/04-tdd-pair US-xx` o `/04-tdd-pair TK-xx`" y DETENTE. No tomes el objetivo de la conversación ni lo inventes.
   - Busca el ID con Grep: `US-xx` en `docs/005-historias-de-usuario.md`, `TK-xx` en `docs/006-tickets-de-trabajo.md`. Si el prefijo no es válido o el ID no existe, alerta, lista los IDs disponibles y DETENTE.

0a. **Leer el Contrato**:
   - Lee `docs/changes/<ID>.md`. Si NO existe, avisa que la historia no fue refinada, pide ejecutar `/03-refinar-historia <ID>` y DETENTE. No inventes escenarios ni uses el contexto de la conversación como sustituto.
   - Revisa el **Estado**:
     - `Borrador`: pide al desarrollador confirmación explícita de que el contrato está aprobado. Con un "sí" claro, cambia el Estado a `Aprobado`; si no, DETENTE.
     - `Aprobado` o `En implementación`: continúa (en el segundo caso, retoma desde la primera tarea sin marcar).
     - `Implementado`: avisa que el cambio ya está implementado, sugiere `/05-verificar-y-revisar <ID>` y DETENTE.
   - Al comenzar, cambia el Estado a `En implementación`.

0b. **Verificar el Entorno de Pruebas**:
   - Comprueba que existan `package.json` en la raíz del proyecto, la dependencia `vitest` y los scripts `test` y `lint`. Si hace falta mockear Jira o Ollama, comprueba también `msw`. Contrasta con la sección **Prerrequisitos** del contrato.
   - Si falta algo, **alerta al usuario** con la lista exacta de lo que falta y DETENTE. No crees el scaffold (`package.json`, `tsconfig`, `vitest.config`, instalación de dependencias) dentro del ciclo TDD: proponlo como paso previo separado y espera confirmación.

=== PASO A PASO DEL CICLO TDD ===
Trabaja un escenario del contrato a la vez, en el orden de la tabla de Trazabilidad.

1. **FASE ROJA (RED)**:
   - Crea o actualiza el archivo de test en `tests/` representando el escenario BDD actual.
   - Ejecuta el test con `npm test -- <ruta-al-test>` (o `npx vitest run <ruta-al-test>`).
   - Confirma que el test **FALLA (RED)** por la razón esperada (método o módulo no implementado).

2. **FASE VERDE (GREEN)**:
   - Escribe el código MÍNIMO e indispensable en `src/` para que el test pase.
   - Reejecuta el test y confirma que cambie a **PASÓ (GREEN)**.

3. **FASE REFACTOR**:
   - Mejora la legibilidad y estructura del código respetando los principios KISS y YAGNI.
   - Verifica que las reglas de acoplamiento de capas pasen ejecutando `npm run lint`.

4. **Actualizar el Contrato** (al cerrar cada escenario):
   - Marca la tarea correspondiente como `[x]`.
   - En la tabla de Trazabilidad, completa la columna **Test** con la ruta y el nombre del test, y el Estado del escenario como `Hecho`.
   - **Escenario sin test:** si un escenario no puede tener test automatizado, DETENTE, explica el motivo y pide aprobación al desarrollador. Solo con su aprobación, escribe en la columna Test `Sin test: <motivo>`, el Estado como `Hecho sin test`, y registra la decisión en **Decisiones y desvíos**. Nunca cierres un escenario como `Hecho` con la columna Test en `_pendiente_`, y nunca omitas un test por tu cuenta.
   - Cuando todos los escenarios y tareas estén completos y el desarrollador los haya validado, cambia el Estado del cambio a `Implementado` y sugiere ejecutar `/05-verificar-y-revisar <ID>`.

=== GUARDAESPALDAS DE NO IMPROVISACIÓN ===
- Si necesitas desviarte del contrato, o encuentras un caso borde o una ambigüedad no especificados: **DETENTE Y PREGUNTA AL DESARROLLADOR**. No improvises.
- Cuando el desarrollador decida, registra la decisión en la sección **Decisiones y desvíos** del contrato (fecha, qué se decidió y por qué). No reescribas por tu cuenta los escenarios ni la trazabilidad.

=== RESTRICCIONES ===
- Avanza en iteraciones cortas de ~50 líneas de código por ciclo.
- NUNCA alteres un test ya aprobado por el desarrollador para forzar que pase. En la fase roja SÍ puedes crear tests nuevos o ajustar el que estás escribiendo en el escenario actual.
- Si crees que un test ya aprobado es incorrecto (error en el test, no en la implementación), DETENTE, explica por qué y espera la decisión del desarrollador. No lo modifiques por tu cuenta.
- Escribe únicamente dentro de `src/` y `tests/` en la raíz del proyecto, **más** `docs/changes/<ID>.md`, donde solo puedes tocar: el Estado, las casillas de Tareas, la columna Test/Estado de la Trazabilidad y la sección Decisiones y desvíos. No modifiques el resto de `docs/`, `README.md`, `CLAUDE.md`, `.claude/` ni otros archivos del repo.
- NO hagas commits ni uses ningún comando que cambie el estado de git (`add`, `commit`, `push`, `checkout`, `reset`, `stash`, etc.). El versionado lo decide el desarrollador. Solo puedes consultar con `git status` y `git diff`.
- Si requieres realizar mocks de servicios externos (Jira REST API), utiliza `msw` o los stubs definidos en el entorno de pruebas.
- Detente al completar cada escenario BDD para solicitar la validación del desarrollador.

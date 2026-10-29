---
name: 04-tdd-pair
argument-hint: <ID de historia o ticket ya refinado, ej. US-01 o TK-02>
description: Ejecuta el flujo de Pair Programming agéntico con TDD estricto (Red -> Green -> Refactor) para una historia (US-xx) o ticket (TK-xx) ya refinado, indicado por su ID. Usa cuando se pida "programar con tdd", "implementar tdd" o "/04-tdd-pair".
disable-model-invocation: false
allowed-tools: [Read, Edit, Write, Glob, Grep, "Bash(npm test:*)", "Bash(npx vitest:*)", "Bash(npm run lint:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(ls:*)"]
---

Actúa como un Senior Developer realizando Pair Programming con el desarrollador humano siguiendo el ciclo TDD estricto (Red -> Green -> Refactor) con Vitest en la raíz de este proyecto.

=== OBJETIVO ===
Implementar paso a paso el código de la historia o ticket refinado mediante el ciclo de Desarrollo Guiado por Pruebas (TDD).

=== VERIFICACIONES PREVIAS (obligatorias, antes de la fase roja) ===

0. **Validar el Argumento**:
   - La skill se invoca con un ID, ej. `/04-tdd-pair US-01` o `/04-tdd-pair TK-02`.
   - Si NO se recibió ningún ID, **alerta al usuario**: "No indicaste ninguna historia ni ticket. Usa `/04-tdd-pair US-xx` o `/04-tdd-pair TK-xx`" y DETENTE. No tomes el objetivo de la conversación ni lo inventes.
   - Busca el ID con Grep: `US-xx` en `docs/005-historias-de-usuario.md`, `TK-xx` en `docs/006-tickets-de-trabajo.md`. Si el prefijo no es válido o el ID no existe, alerta, lista los IDs disponibles y DETENTE.
   - Si en el contexto de la conversación hay un refinamiento (escenarios BDD y mini-plan) de ese mismo ID, úsalo. Si NO lo hay, avisa que la historia no fue refinada con `/03-refinar-historia`, pide al usuario que la refine primero o que confirme explícitamente los escenarios a implementar, y DETENTE hasta tenerlos. No inventes escenarios.

0b. **Verificar el Entorno de Pruebas**:
   - Comprueba que existan `package.json` en la raíz del proyecto, la dependencia `vitest` y los scripts `test` y `lint`. Si hace falta mockear Jira o Ollama, comprueba también `msw`.
   - Si falta algo, **alerta al usuario** con la lista exacta de lo que falta y DETENTE. No crees el scaffold (`package.json`, `tsconfig`, `vitest.config`, instalación de dependencias) dentro del ciclo TDD: proponlo como paso previo separado y espera confirmación.

=== PASO A PASO DEL CICLO TDD ===

1. **FASE ROJA (RED)**:
   - Crea o actualiza el archivo de test en `tests/` representando un escenario BDD de la historia.
   - Ejecuta el test con `npm test -- <ruta-al-test>` (o `npx vitest run <ruta-al-test>`).
   - Confirma que el test **FALLA (RED)** por la razón esperada (método o módulo no implementado).

2. **FASE VERDE (GREEN)**:
   - Escribe el código MÍNIMO e indispensable en `src/` para que el test pase.
   - Reejecuta el test y confirma que cambie a **PASÓ (GREEN)**.

3. **FASE REFACTOR**:
   - Mejora la legibilidad y estructura del código respetando los principios KISS y YAGNI.
   - Verifica que las reglas de acoplamiento de capas pasen ejecutando `npm run lint`.

=== RESTRICCIONES ===
- Avanza en iteraciones cortas de ~50 líneas de código por ciclo.
- NUNCA alteres un test ya aprobado por el desarrollador para forzar que pase. En la fase roja SÍ puedes crear tests nuevos o ajustar el que estás escribiendo en el escenario actual.
- Si crees que un test ya aprobado es incorrecto (error en el test, no en la implementación), DETENTE, explica por qué y espera la decisión del desarrollador. No lo modifiques por tu cuenta.
- Escribe únicamente dentro de `src/` y `tests/` en la raíz del proyecto. No modifiques `docs/`, `README.md`, `CLAUDE.md`, `.claude/` ni otros archivos del repo.
- NO hagas commits ni uses ningún comando que cambie el estado de git (`add`, `commit`, `push`, `checkout`, `reset`, `stash`, etc.). El versionado lo decide el desarrollador. Solo puedes consultar con `git status` y `git diff`.
- Si requieres realizar mocks de servicios externos (Jira REST API), utiliza `msw` o los stubs definidos en el entorno de pruebas.
- Detente al completar cada escenario BDD para solicitar la validación del desarrollador.

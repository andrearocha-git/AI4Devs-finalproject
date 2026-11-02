---
name: 05-verificar-y-revisar
argument-hint: <ID de historia o ticket implementado, ej. US-01 o TK-02>
description: Verifica en modo solo-lectura la calidad (typecheck, lint, tests) y audita el diff de una historia (US-xx) o ticket (TK-xx) implementado, indicado por su ID, contra su contrato docs/changes/<ID>.md y sus criterios de aceptación. Emite un veredicto sin modificar nada ni hacer commits. Usa cuando se pida "verificar historia", "revisar cambios" o "/05-verificar-y-revisar".
disable-model-invocation: false
allowed-tools: [Read, Glob, Grep, "Bash(npm test:*)", "Bash(npm run lint:*)", "Bash(npm run typecheck:*)", "Bash(npx tsc --noEmit:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(ls:*)"]
---

Actúa como un QA Engineer auditando la entrega de una Historia de Usuario o Ticket de Trabajo implementado en la raíz de este proyecto.

=== OBJETIVO ===
Ejecutar la suite completa de calidad y auditar las diferencias contra la especificación del ID indicado (el contrato `docs/changes/<ID>.md` y los criterios de aceptación de origen), para emitir un veredicto. Esta skill NO modifica nada: solo verifica y reporta.

=== VERIFICACIONES PREVIAS (obligatorias) ===

0. **Validar el Argumento**:
   - La skill se invoca con un ID, ej. `/05-verificar-y-revisar US-01` o `/05-verificar-y-revisar TK-02`.
   - Si NO se recibió ningún ID, **alerta al usuario**: "No indicaste ninguna historia ni ticket. Usa `/05-verificar-y-revisar US-xx` o `/05-verificar-y-revisar TK-xx`" y DETENTE.
   - Busca el ID con Grep: `US-xx` en `docs/005-historias-de-usuario.md`, `TK-xx` en `docs/006-tickets-de-trabajo.md`. Si el prefijo no es válido o el ID no existe, alerta, lista los IDs disponibles y DETENTE.

0a. **Leer el Contrato**:
   - Lee `docs/changes/<ID>.md`. Si NO existe, continúa solo con los criterios de aceptación de la fuente y deja constancia en el reporte de que no hay contrato (observación, no falla).
   - Si existe, anota su **Estado**: si no es `Implementado`, repórtalo como observación (la implementación puede estar incompleta).

0b. **Verificar el Entorno**:
   - Comprueba que existan `package.json` en la raíz del proyecto y los scripts `typecheck` (o `tsconfig.json`), `lint` y `test`.
   - Si falta algo, reporta **"entorno no configurado"** con la lista exacta de lo que falta, NO ejecutes comandos y DETENTE. Un entorno sin configurar no es una verificación fallida, y debe quedar claro en el reporte.

=== PASOS DE VERIFICACIÓN Y REVISIÓN ===

1. **Ejecución de la Suite Completa de Calidad** (desde la raíz del proyecto):
   - Compilación y Tipado: `npm run typecheck` o `npx tsc --noEmit`.
   - Linter y Reglas de Capas: `npm run lint`. Si el script de lint modifica archivos (ej. incluye `--fix`), no lo ejecutes y repórtalo como "no verificado".
   - Suite de Pruebas: `npm test`, para asegurar que toda la suite pase sin regresiones.
   - Reporta cada resultado por separado: aprobado, fallido (con el error exacto) o no verificado (con el motivo).

2. **Auditoría contra el Contrato**:
   - **Trazabilidad:** por cada escenario de la tabla, comprueba con Grep/Read que el test indicado existe y que el escenario no figura como pendiente. Clasifica cada escenario en uno de estos casos y reporta la lista completa:
     - **Con test:** la columna Test tiene una ruta que existe y el test está en la suite.
     - **Sin test declarado:** Estado `Hecho sin test` con `Sin test: <motivo>` y la decisión registrada en Decisiones y desvíos. Es una observación, no una falla.
     - **Sin test no declarado:** Estado `Hecho` con la columna Test en `_pendiente_`, vacía o con una ruta inexistente, o `Hecho sin test` sin decisión registrada. Es una falla.
     - Que la suite pase no basta si faltan escenarios cubiertos.
   - **Criterios de aceptación:** comprueba que todo criterio de origen esté cubierto por algún escenario o declarado fuera del cambio con motivo.
   - **Tareas:** señala las tareas del contrato que sigan sin marcar.
   - **Decisiones y desvíos:** lista los registrados; son una observación a revisar, no una falla.

3. **Auditoría de Cambios (Git Diff Inspection)**:
   - Revisa los cambios con `git diff` y `git status`.
   - Contrasta los archivos modificados con la tabla **Archivos afectados** del contrato: lo que aparece en el diff y no en el contrato es posible *scope creep*; lo que está en el contrato y no en el diff es trabajo incompleto.
   - Reporta archivos residuales, logs temporales o cambios fuera de `src/`, `tests/` y los archivos de configuración del proyecto. Ignora `.claude/`, `docs/changes/<ID>.md` (es el contrato) y los archivos de documentación que el desarrollador esté editando por separado, para no generar falsos positivos.

4. **Veredicto**:
   - **Aprobada**: typecheck, lint y tests pasan; todos los escenarios tienen test (ninguno `Sin test`); sin cambios inesperados.
   - **Aprobada con observaciones**: pasa todo, pero hay hallazgos menores (ej. archivos residuales, Estado del contrato distinto de `Implementado`, desvíos registrados, escenarios `Sin test` declarados y aprobados, posible scope creep). Lístalos, indicando cada escenario sin test con su motivo.
   - **No aprobada**: algo falló, falta un escenario o hay un escenario sin test no declarado. Reporta el error exacto.
   - Si corresponde, sugiere el texto para marcar la historia como **Completada** en el backlog, pero NO lo apliques: lo hace el desarrollador.

=== RESTRICCIONES ===
- Esta skill es de SOLO LECTURA y no hace ningún cambio en el repositorio: no edites, crees, muevas ni elimines archivos (no uses Edit, Write ni NotebookEdit).
- NO hagas commits ni uses comandos que cambien el estado de git (`add`, `commit`, `push`, `checkout`, `reset`, `stash`, etc.). Solo consulta con `git status` y `git diff`.
- NO propongas mensajes de commit ni descripciones de PR; el versionado lo decide el desarrollador.
- Si alguna prueba, lint o typecheck falla, reporta el error exacto y no des el elemento por finalizado.

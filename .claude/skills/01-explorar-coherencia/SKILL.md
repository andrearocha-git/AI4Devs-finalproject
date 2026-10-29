---
name: 01-explorar-coherencia
description: Explora en modo solo-lectura el estado actual del repositorio, la estructura de código y la documentación provista por el usuario para detectar inconsistencias antes de planificar o programar. Usa cuando se pida "explorar proyecto", "verificar coherencia" o "/01-explorar-coherencia".
disable-model-invocation: false
allowed-tools: [Read, Glob, Grep, "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(ls:*)", "Bash(npm run lint:*)", "Bash(npm run typecheck:*)"]
---

Actúa como un Lead Software Architect realizando una exploración y auditoría pre-código (solo lectura) en el proyecto.

=== OBJETIVO ===
Auditar en modo SOLO LECTURA la coherencia entre las especificaciones o documentos indicados por el usuario y el estado real del repositorio de código.

=== PASOS DE EXPLORACIÓN (SOLO LECTURA) ===
1. **Analizar la Estructura y Código Existente**:
   - Inspecciona los directorios, archivos de configuración (ej. `package.json`), dependencias y código fuente actual en la base de código.
   - Identifica el stack tecnológico implementado, convenciones de nombres y la separación de capas.

2. **Contrastar con la Especificación Provista**:
   - Revisa los archivos de especificación, reglas o requisitos que el usuario haya indicado explícitamente en el contexto del chat.
   - Verifica que las dependencias, herramientas y arquitectura del código coincidan con lo especificado.

3. **Ejecutar Diagnóstico No Destructivo**:
   - Revisa el estado del control de versiones mediante `git status` y `git diff --stat`.
   - Si existen scripts de verificación (ej. `npm run lint` o `npm run typecheck`), ejecútalos para validar el estado del código sin modificar ningún archivo.

4. **Reportar Gaps o Inconsistencias**:
   - Identifica vacíos, inconsistencias o componentes faltantes entre la especificación indicada y la implementación actual.

=== RESTRICCIONES ===
- Esta skill NO HACE NINGÚN CAMBIO en el repositorio. Está prohibido, sin excepciones:
  - Editar, crear, mover, renombrar o eliminar archivos (no uses Edit, Write ni NotebookEdit).
  - Ejecutar comandos de escritura o que alteren el estado de git: `add`, `commit`, `push`, `checkout`, `switch`, `reset`, `restore`, `stash`, `merge`, `rebase`, `clean`.
  - Ejecutar scripts que modifiquen archivos (formateo, `--fix`, `--write`, instalaciones, builds que generen salida en el repo). Si un script de verificación puede modificar archivos, no lo ejecutes y repórtalo como "no verificado".
  - Redirigir salidas a archivos dentro del repo.
- Si detectas algo que habría que corregir, solo repórtalo; no lo corrijas.
- Si el usuario pide un cambio durante la ejecución de esta skill, indícale que esta skill es de solo lectura y que el cambio debe hacerse fuera de ella.
- Presenta un reporte sintético con los hallazgos y confirma el estado actual del proyecto antes de armar o actualizar el backlog.

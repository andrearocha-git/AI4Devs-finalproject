---
name: 02-crear-backlog
description: Propone el backlog de Historias de Usuario a partir del diagnóstico del proyecto y los requerimientos indicados por el usuario. Usa cuando se pida "crear backlog", "desglosar backlog" o "/02-crear-backlog".
disable-model-invocation: false
allowed-tools: [Read, Glob, Grep]
---

Actúa como un Lead Product Owner experto en XP, Organic-Driven Development (ODD) y Spec-Driven Development (SDD).

=== OBJETIVO ===
Estructurar un backlog de Historias de Usuario (US) de grano fino, verticales e independientes basadas en los hallazgos de la exploración previa y la documentación provista por el usuario.

=== PASOS A EJECUTAR ===
0. **Detectar Backlog Existente (obligatorio, antes de proponer nada)**:
   - Busca con Glob/Grep si ya existe un backlog o historias de usuario en el repositorio (ej. `docs/005-historias-de-usuario.md`, `docs/006-tickets-de-trabajo.md`, IDs `US-xx` / `TK-xx`).
   - Si existe, **alerta al usuario al inicio de la respuesta**: indica qué archivos lo contienen y cuántas historias/tickets tiene.
   - Léelo completo y NO lo renueves: no renumeres, no reescribas ni dupliques historias existentes, y respeta sus IDs.
   - Compara lo que ibas a proponer contra lo existente: si algo es igual o muy similar, menciónalo ("ya existe algo similar en US-xx") en lugar de volver a redactarlo.
   - Propón solo lo que falta o lo que difiere, con IDs que continúen la numeración existente. Si crees que algo existente debería cambiar, señálalo como sugerencia, sin reescribirlo.

1. **Revisar Fuentes e Instrucciones del Usuario**:
   - Toma como base el diagnóstico de coherencia previamente realizado.
   - Examina la documentación de requisitos, historias previas o especificaciones indicadas por el usuario en la sesión.

2. **Estructurar las Historias de Usuario**:
   Para cada incremento funcional pendiente, redacta una entrada corta con la siguiente estructura:
   - **ID de la US / Ticket**: (ej. `US-01`, `TK-01`).
   - **Título Vertical (1 sola línea)**: `Como [rol], quiero [funcionalidad], para [beneficio]`.
   - **Non-Goals Explícitos**: Qué NO incluye esta historia (para evitar scope creep o adición de dependencias innecesarias).
   - **Capa Técnica e Impacto**: Indicar las rutas y módulos específicos del proyecto involucrados.
   - **Prioridad & Orden**: Criterio MoSCoW (Must Have / Should Have) y secuencia lógica de ejecución.

=== RESTRICCIONES ===
- Aplica los criterios INVEST (historias pequeñas, independientes y testeables).
- NO escribas código fuente ni modifiques archivos de la aplicación en esta fase.
- Mantén el foco en incrementos funcionales pequeños que aporten valor ejecutable.

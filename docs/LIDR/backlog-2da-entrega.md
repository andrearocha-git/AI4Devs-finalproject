# Backlog de la 2.ª entrega — orden de ejecución

> Documento de trabajo (no está ligado a ninguna sección de `README.md`). **No reemplaza** `005-historias-de-usuario.md` ni `006-tickets-de-trabajo.md`: ordena lo que ya existe en ellos para entregar valor verificable en cada hito. Respeta los IDs existentes; lo nuevo es solo una **sugerencia** (§4) y requiere aprobación antes de pasar a `005`/`006`.
>
> Fecha: 2026-11-02 · Rama: `feature/entrega-2-ANR`

## 1. Backlog existente (punto de partida)

| Archivo | Contenido |
|---|---|
| `docs/005-historias-de-usuario.md` | 3 historias: **US-01** (configurar, 6 CA), **US-02** (elegir y consultar el ticket en Jira, 6 CA), **US-03** (preparar rama, carpeta y documento con Ollama, 10 CA). |
| `docs/006-tickets-de-trabajo.md` | **TK-00** y **TK-01** (hechos), **TK-02** (paraguas dividido en **TK-02a … TK-02g**), **TK-03** (paraguas dividido en **TK-03a** y **TK-03b**). |

Estado: TK-00, TK-01, TK-02a, TK-02b y TK-02c implementados y verificados (197 tests, typecheck y lint en verde; TK-02a y TK-02b revisados y fusionados en `feature/TK-02`). Todo lo demás está especificado y sin código.

**Observación INVEST (sin modificar nada).** US-03 falla S (Small): 10 CA y esfuerzo Alto. TK-03 también es grande (dos comandos, cuatro prompts y todas las pantallas de resultado). Por eso el orden de abajo entrega las historias **por criterios de aceptación**, no de una vez, y TK-03 ya se dividió en TK-03a y TK-03b (§4).

## 2. Principio de orden

1. **Cada hito termina con algo que el desarrollador puede ejecutar** y con tres verificaciones: pruebas automáticas (unitarias), una prueba de integración con dependencias reales o simuladas, y una comprobación manual de aceptación.
2. **Primero lo que desbloquea a los demás y lo que se verifica más barato** (Jira y Git son deterministas; Ollama es lo más lento e incierto).
3. **Ollama no bloquea el primer valor**: su fallback determinista permite entregar el flujo completo aunque la IA llegue después.
4. Cada ticket pasa por el ciclo `/03-refinar-historia` → aprobación → `/04-tdd-pair` → `/05-verificar-y-revisar` → commit.

## 3. Orden propuesto

### Hito 0 — Cimientos (hecho)

| # | Ticket | Estado |
|---|---|---|
| 0.1 | TK-00 Scaffold | ✅ Implementado |
| 0.2 | TK-01 SQLite Storage Manager | ✅ Implementado |

### Hito 1 — «Configuro la herramienta contra mi Jira y mis repositorios» (US-01 completa)

**Valor:** el desarrollador instala, da de alta su token, sus claves de proyecto (validadas en Jira real) y sus repositorios (validados en Git real). Es la primera demo ejecutable.

| # | Ticket | Qué aporta | Depende de |
|---|---|---|---|
| 1.1 | **TK-02a** Base compartida ✅ | `StepResult`, configuración inyectable, resolutor de tipo, fixtures, regla de lint, umbral de cobertura | TK-01 |
| 1.2 | **TK-02b** Jira REST Client ✅ | Validar claves, `displayName`, clasificación de fallos | 1.1 |
| 1.3 | **TK-02c** Git Manager ✅ | `validateRepository` y `createBranch` completos | 1.1 |
| 1.4 | **TK-02g** Orquestador: gestión | Alta, edición y baja de proyectos y repositorios; sufijo; errores claros | 1.2, 1.3 |
| 1.5 | **TK-03a** CLI base + `devflow config` | `cli.ts`, `config.command.ts`, prompts de alta | 1.4 |

*Nota de orden:* 1.2 y 1.3 son independientes y pueden ir en paralelo. `createBranch` ya queda implementado aquí aunque aún nadie lo use; se verifica con repositorios temporales.

**Historias cubiertas:** US-01 CA1-CA5. *(CA6 —aviso al iniciar sin claves— se cierra en el Hito 3.)*

**Verificación del hito**

- Automática: tests de 02a, 02b (msw), 02c (repos Git temporales), 02g y 03a; `npm run typecheck && npm run lint && npm test`.
- Integración: ejecutar `devflow config` contra el Jira de pruebas (credenciales en `~/.config/devflow/jira.env`) y contra un repositorio Git local con remoto `origin`; verificar que un token inválido se distingue de una clave inexistente.
- Aceptación manual: repetir los CA1-CA5 de US-01 a mano; comprobar que la base `devflow.db` queda con la configuración sin duplicados.

### Hito 2 — «Preparo un ticket de punta a punta» (US-02 y US-03 núcleo)

**Valor:** `devflow start` consulta Jira, crea la rama, la carpeta y el documento con la Fase 1. Es el valor central del producto.

| # | Ticket | Qué aporta | Depende de |
|---|---|---|---|
| 2.1 | **TK-02d** FileSystem Manager + plantillas | Carpeta y documento fuera del repo, Fase 1 idempotente, `fase1.json` | 1.1 |
| 2.2 | **TK-02e** Ollama AI Transformer | Prompts, schemas, Ajv, posprocesado, fallback | 1.1 |
| 2.3 | **TK-02f** Orquestador: `startTicket` | Flujo completo, `ticket_logs`, reutilización de Fase 1 | 1.2, 1.3, 2.1, 2.2 |
| 2.4 | **TK-03b** `devflow start` | Selección de ticket y repositorio, carga manual, confirmación, progreso, pantallas de resultado | 2.3 |

*Nota de orden:* 2.1 y 2.2 son independientes (se pueden paralelizar). Si Ollama se retrasa, 2.2 puede entrar con solo el camino de fallback determinista y completarse después sin bloquear 2.3, siempre que el contrato del ticket lo apruebe.

**Historias cubiertas:** US-02 CA1-CA6 y US-03 CA1-CA10.

**Verificación del hito**

- Automática: tests de 02d, 02e, 02f y 03b; prueba de integración `tests/integration/ticket-flow.e2e.test.ts` con SQLite real en memoria, Git y disco temporales, y Jira/Ollama simulados.
- Integración real (manual, una vez): un ticket del Jira de pruebas con Ollama `qwen2.5:3b` (≈45 s en CPU según el spike; timeout de 120 s) sobre un repositorio local de prueba; repetirlo con Ollama apagado para ver el fallback.
- Aceptación manual: recorrer los CA de US-02 y US-03 (épica, sin red, token inválido, cambios pendientes, rama existente, segundo repositorio, clave sin repositorios, `--base`).

### Hito 3 — «Listo para usar y entregar» (endurecimiento)

**Valor:** la herramienta se puede instalar y usar sin acompañamiento, y los huecos documentales están cerrados.

| # | Trabajo | Notas |
|---|---|---|
| 3.1 | Cierre de **US-01 CA6** y comprobación de **US-02 CA3** | Aviso «primero configura una clave» al iniciar sin claves |
| 3.2 | Instalación: `bin` en `package.json`, script `build`/`start`, instrucciones en `docs/001` §1.4 y README §1.4 | Cierra **H-05**; actualizar «Build / test commands» en `CLAUDE.md` |
| 3.3 | ~~Decidir H-02, H-03 y H-04~~ | Decididos el 2026-11-02 |
| 3.4 | ~~Validar **H-06** (nombres de `devflow config`)~~ | Decidido 2026-11-02 |
| 3.5 | Prueba de aceptación completa sobre Windows 10/11 | Rutas, `%APPDATA%`, terminales; el desarrollo corre en WSL |
| 3.6 | Cobertura y revisión final | Umbral definido en TK-02a; `/code-review` del diff completo |

## 4. Sugerencias de cambio al backlog (no aplicadas)

1. ✅ **Aplicada (2026-11-02): dividir TK-03** (antes una sola unidad de esfuerzo Medio que en la práctica es grande) en dos tickets, para poder entregar el Hito 1 sin esperar al Orquestador completo:
   - **TK-03a** — `src/tui/cli.ts`, `config.command.ts` y los prompts de alta de claves, repositorios y sufijo. Depende de TK-02g.
   - **TK-03b** — `start.command.ts`, selección de ticket y repositorio, carga manual, confirmación, spinner y pantallas de resultado. Depende de TK-02f.
   TK-03 pasó a ser paraguas (como TK-02) y `006` y `README.md` ya lo reflejan.
2. **Alternativa más fina para el Hito 1:** dividir TK-02g en «proyectos y sufijo» (depende solo de TK-02b) y «repositorios» (depende de TK-02c). Permite una primera demo con solo Jira. Solo vale la pena si 02b llega bastante antes que 02c.
3. **Entregar US-03 por criterios** (sin tocar el texto de la historia): la tabla de abajo es la trazabilidad CA → tickets.

## 5. Trazabilidad de criterios de aceptación a tickets

| Historia / CA | Resumen | Tickets que lo cierran | Hito |
|---|---|---|---|
| US-01 CA1-2 | Alta y validación de claves | 02b · 02g · 03a | 1 |
| US-01 CA3 | Repositorio asociado y validado | 02c · 02g · 03a | 1 |
| US-01 CA4 | Sufijo propuesto desde Jira | 02b · 02g · 03a | 1 |
| US-01 CA5 | Actualizar sin duplicar | 02g · 03a (+ TK-01 ya hecho) | 1 |
| US-01 CA6 | Iniciar sin claves | 02f · 03b | 3 |
| US-02 CA1 | Lista de asignados sin épicas | 02b · 02g · 03b | 2 |
| US-02 CA2 | Título, descripción y tipo desde Jira | 02b · 02f | 2 |
| US-02 CA3 | Clave no configurada, antes de llamar a Jira | 02g · 03b | 2 |
| US-02 CA4-5 | Fallback manual (red, token, ticket inexistente) | 02b · 02f · 03b | 2 |
| US-02 CA6 | Épica bloqueada | 02a · 02f · 03b | 2 |
| US-03 CA1 | Rama, carpeta y documento | 02c · 02d · 02e · 02f | 2 |
| US-03 CA2-3 | Cambios pendientes / pull fallido | 02c · 02f · 03b | 2 |
| US-03 CA4 | Ollama caído → documento sin redactar | 02e · 02d · 02f | 2 |
| US-03 CA5 | Rama ya existente | 02c · 02f (**H-04** abierto) | 2 |
| US-03 CA6 | Segundo repositorio y Fase 1 reutilizada | 02d · 02f | 2 |
| US-03 CA7 | Clave sin repositorios: solo documento | 02f | 2 |
| US-03 CA8 | `--base` de una sola vez | 02c · 02f · 03b | 2 |
| US-03 CA9 | Reprocesar la Fase 1 (`--reprocesar`) | 02d · 02e · 02f · 03b | 2 |
| US-03 CA10 | Rama solo en el remoto: se detiene con aviso | 02c · 02f · 03b | 2 |

## 6. Dependencias entre tickets

```text
TK-00 ─► TK-01 ─► TK-02a ─┬─► TK-02b ─┬─► TK-02g ─► TK-03a        (Hito 1)
                          ├─► TK-02c ─┤
                          │           └──────────┐
                          ├─► TK-02d ────────────┼─► TK-02f ─► TK-03b   (Hito 2)
                          └─► TK-02e ────────────┘
```

## 7. Decisiones previas a tomar (para no bloquear el refinamiento)

| Decisión | Se necesita antes de | Origen |
|---|---|---|
| ~~Umbral de cobertura de la Service Layer~~ — **decidido (2026-11-02): 80 %**, se aplica en TK-02a | — | TK-01 |
| ~~Nombres de `devflow config` y `devflow config proyectos` (**H-06**)~~ — **decidido (2026-11-02)** | — | `009` |
| ~~Comportamiento del checkout con la rama ya existente (**H-04**)~~ — **decidido (2026-11-02): solo informar, sin checkout** | — | `009` |
| ~~Cómo se pide reprocesar la Fase 1 (**H-02**)~~ — **decidido (2026-11-02): `--reprocesar`** | — | `009` |
| ~~`ConfirmActionsPrompt` en el diagrama de secuencia (**H-03**)~~ — **decidido (2026-11-02): confirmación única, cancelable** | — | `009` |
| ~~Aprobación de dividir TK-03 (§4, punto 1)~~ — **aprobada (2026-11-02)**. Los puntos 2 y 3 de la §4 siguen sin aplicar | — | este documento |

## 8. Antes de empezar el Hito 1

La entrega es la rama `feature/entrega-2-ANR` (sin PR a `main`). `src/.gitkeep` ya se eliminó (2026-11-02).

1. Cerrar los huecos de la §7, uno por vez (empezando por los que bloquean a TK-02a y TK-02c).
2. Ejecutar `/03-refinar-historia TK-02a`.
3. Tildar el DoD de TK-00 y TK-01 en `006` cuando corresponda.

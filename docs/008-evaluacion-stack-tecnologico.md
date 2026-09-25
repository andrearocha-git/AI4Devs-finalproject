# ADR-006.1: Evaluación del stack tecnológico de implementación — Node.js/TypeScript frente a alternativas

| Campo | Detalle |
|---|---|
| **Fecha** | 2026-09-25 |
| **Estado** | Propuesto — en evaluación, se cierra en la próxima entrega. Recomienda mantener la propuesta de partida de `002-arquitectura-del-sistema.md` §2.3 |
| **Autores** | Andrea Rocha |
| **Formato** | MADR v3.0 |
| **Documentos relacionados** | `docs/PRD.md`, `docs/ADR-001-arquitectura-inicial.md`, `docs/002-arquitectura-del-sistema.md` §2.2–§2.3 |

> **Nota de alcance.** Este documento no modifica ninguna decisión previa. Audita, con las restricciones reales del parque de PCs del equipo, si **Node.js / TypeScript** (ya fijado en `002` §2.3) sigue siendo la opción correcta frente a cinco alternativas. Las cifras de disco y RAM son **órdenes de magnitud de referencia** (valores típicos en Windows 10/11 x64, proceso en reposo o flujo corto), no mediciones sobre las máquinas del equipo; la sección 5 propone cómo medirlas antes de cerrar el ADR.

---

## 1. Contexto y Problema de Infraestructura

DevFlow CLI es una herramienta de **ejecución corta y esporádica** (una invocación por ticket, pocas veces al día por desarrollador) que orquesta cuatro integraciones: Jira REST (HTTP + JSON), Ollama (HTTP + JSON local), Git (invocación de proceso `git.exe`) y SQLite embebida (archivo local, modo WAL). La interacción con el usuario es una TUI **lineal y guiada** (prompts, confirmaciones, spinners de progreso por paso, resumen final), no una aplicación de pantalla completa de larga duración.

El problema no es "qué lenguaje puede hacer esto" —los seis evaluados pueden— sino **cuál lo hace sin empeorar un entorno que ya está al límite**:

### 1.1. Restricciones operativas del parque de PCs

| # | Restricción | Implicación para la elección de stack |
|---|---|---|
| R1 | **8 GB de RAM total** por equipo | Cualquier runtime que reserve memoria de forma persistente (VM, daemon, JVM con heap grande) compite directamente con los IDEs. |
| R2 | **~35 GB libres en disco** | Instalar SDKs completos, toolchains de compilación nativa (p. ej. Visual Studio Build Tools, varios GB) o distros WSL consume un presupuesto que ya comparten los modelos de Ollama (2–5 GB por modelo). |
| R3 | **Carga concurrente pesada:** IntelliJ IDEA, VSCode, NetBeans, DBeaver, IBM Data Studio abiertos a la vez | Cuatro de esos cinco procesos son JVM (IntelliJ, NetBeans, DBeaver y Data Studio sobre Eclipse) y VSCode es Electron. En la práctica el equipo ya opera cerca o por encima de la RAM física, con paginación a disco. |
| R4 | **Node.js instalado en el 100% de las máquinas** (requerido por los 2 proyectos Angular) | Único runtime cuya presencia está garantizada por política del equipo. Su **versión** no está garantizada (ver §3.1, riesgo de versión). |
| R5 | **Windows 10/11 exclusivamente** (Non-Goal del PRD: sin macOS/Linux) | La TUI debe comportarse bien en Windows Terminal, en `conhost` heredado de Windows 10 y en la terminal integrada de los IDEs. |

### 1.2. Presupuesto de memoria estimado del puesto de trabajo

| Proceso | RAM típica en uso |
|---|---|
| Windows 10/11 + servicios + antivirus corporativo | 2,0 – 3,0 GB |
| IntelliJ IDEA (proyecto Spring Boot indexado) | 1,5 – 3,0 GB |
| VSCode (Electron + extensiones Angular/TS) | 0,5 – 1,5 GB |
| NetBeans | 0,7 – 1,5 GB |
| DBeaver | 0,4 – 1,0 GB |
| IBM Data Studio | 0,7 – 1,5 GB |
| **Subtotal sin DevFlow ni Ollama** | **≈ 5,8 – 11,5 GB** |
| Ollama con un modelo pequeño (3B–4B cuantizado) cargado | + 2,0 – 4,0 GB |

**Hallazgo de auditoría principal:** sobre este presupuesto, la diferencia entre el runtime más ligero (Go, ~15 MB) y el más pesado razonable (JVM, ~150 MB) es **< 2% de la RAM total**, mientras que **Ollama por sí solo supone un 25–50%**. La elección de lenguaje importa, pero **el riesgo dominante de memoria del producto es Ollama, no el CLI**. Esto no cambia el resultado de este ADR, pero sí fija qué se debe vigilar (ver §5.3).

---

## 2. Criterios de Evaluación (Decision Drivers)

| ID | Criterio | Peso | Qué se mide |
|---|---|---|---|
| **D1** | **Impacto en disco** | 20% | Runtime/SDK adicional a instalar en cada puesto vs. reutilizar lo existente; tamaño de dependencias y del artefacto distribuible; toolchains nativas necesarias. |
| **D2** | **Consumo de RAM** | 20% | Huella residente (RSS) durante una ejecución, con IntelliJ/Data Studio activos. Se valora también que el proceso **no deje nada residente** al terminar (sin daemons ni VMs). |
| **D3** | **Rendimiento y TUI en Windows** | 25% | Tiempo de arranque en frío; calidad de spinners, prompts, listas y colores en Windows Terminal, `conhost` (Win10) y terminales integradas; compatibilidad con Git Bash/mintty. |
| **D4** | **Mantenibilidad y DevEx** | 35% | Tipado estático (los contratos `StepResult<T>`, `ContextoTicket`, `Ok \| FallbackManual \| FallbackDeterminista \| ErrorBloqueante` ya existen en `002` §2.2); manejo de errores; facilidad de tests unitarios y *mocks* de Jira/Ollama/Git/SQLite; validación de schema JSON (ADR-003.1); curva de aprendizaje para un equipo Java Spring Boot + Angular de 5 personas. |

Justificación de los pesos: D4 pesa más porque la herramienta la mantendrá el propio equipo en tiempo parcial y su valor depende de que los fallbacks (ADR-003.1, ADR-005.1) estén bien probados. D1 y D2 pesan lo mismo y menos de lo que su prominencia sugiere, porque —como muestra §1.2— el CLI es un proceso corto cuyo coste marginal es pequeño **siempre que no arrastre un runtime residente o un SDK de varios GB**.

---

## 3. Análisis Comparativo Detallado

### 3.1. Línea base — Node.js / TypeScript

**Stack concreto (según `002` §2.3):** Node.js LTS ≥ 20, TypeScript, Commander, Ink + `@inquirer/prompts`, `better-sqlite3` o `node:sqlite`, `fetch` nativo para Jira/Ollama, `child_process` para `git.exe`.

- **Disco (D1):** runtime **ya presente (0 MB adicionales)**. Dependencias del proyecto: ~30–80 MB en `node_modules` (Ink arrastra React y `yoga-layout`; TypeScript y Vitest son solo de desarrollo). Distribuido como paquete npm instalado globalmente o `npx`, el coste por puesto es de decenas de MB.
  - ⚠️ **Riesgo — módulos nativos:** `better-sqlite3` publica binarios precompilados para Windows x64 por versión ABI de Node; si la versión de Node del puesto no tiene *prebuild*, `npm install` intenta compilar con `node-gyp`, lo que exige **Python + Visual Studio Build Tools (varios GB)** — inaceptable con R2. Mitigación: fijar la versión de Node soportada, o usar `node:sqlite` (integrado en el runtime a partir de Node 22.x, sin compilación ni dependencia nativa; verificar su nivel de estabilidad en la versión LTS elegida).
- **RAM (D2):** proceso Node en reposo ~30–50 MB RSS; con Ink/React montado y un flujo completo, ~60–100 MB. **Nada queda residente** al terminar. Con `@inquirer/prompts` + un spinner simple (sin Ink) el pico baja a ~40–60 MB.
- **TUI Windows (D3):** arranque en frío ~150–400 ms (la carga de módulos de Ink/React es el componente dominante), sobrado frente a la meta de ≤ 2 min del PRD. libuv activa el modo *Virtual Terminal* de la consola, por lo que colores ANSI, cursor y redibujado funcionan en Windows Terminal y en `conhost` de Windows 10 (1809+). Los spinners con glifos Braille pueden verse mal con fuentes antiguas de `conhost`; `ink-spinner`/`cli-spinners` degradan a ASCII con detección de soporte Unicode. Ecosistema de prompts (inquirer, ink) muy maduro y probado en Windows por la base de usuarios de Angular CLI, Vite, etc.
- **DevEx (D4):** TypeScript `strict` expresa directamente la unión discriminada del contrato de resultado; el compilador obliga a tratar cada variante (`never` en el `switch`), lo que protege exactamente la propiedad que ADR-001 §0 exige (ningún fallo sin clasificar). Validación del JSON de Ollama con Zod/Ajv generando el tipo desde el schema (una sola fuente de verdad). Tests con Vitest/Jest: *mocks* de módulos, `msw`/`nock` para Jira y Ollama, SQLite en memoria (`:memory:`). **Curva de aprendizaje baja**: todo el equipo toca TypeScript en los proyectos Angular, y los 3 perfiles backend Java reconocen tipado nominal/estructural sin gran esfuerzo.
  - ⚠️ **Riesgo — versión de Node:** "Node instalado en el 100%" ≠ "Node ≥ 20 en el 100%". Los proyectos Angular pueden fijar una versión anterior. Mitigación: declarar `engines.node`, comprobar la versión al arrancar con un mensaje claro, y/o gestionar versiones con `nvm-windows`/Volta. Alternativa si el conflicto es real: empaquetar como *Single Executable Application* de Node (~70–100 MB, sin depender del Node del sistema), a costa de perder la ventaja de D1.

### 3.2. Shell Script (Bash) + curl + jq (vía Git Bash / WSL)

- **Disco (D1):**
  - *Git Bash:* ya instalado con Git for Windows (incluye `bash` y `curl`). Falta `jq` (~1 MB, trivial) y un cliente SQLite (`sqlite3.exe`, ~2 MB). Impacto mínimo.
  - *WSL2:* **descartable por disco y RAM** — una distro Ubuntu ocupa 1–3 GB iniciales y crece con el uso (disco virtual `.vhdx` que no se compacta solo).
- **RAM (D2):**
  - *Git Bash:* cada invocación de `curl`, `jq`, `sqlite3`, `git` es un proceso efímero de pocos MB; huella total muy baja. Coste oculto: en Windows, crear procesos bajo la capa de emulación POSIX de MSYS2 es lento (decenas de ms por `fork`), lo que se nota en scripts con muchos subprocesos.
  - *WSL2:* la VM `vmmem` reserva memoria de forma dinámica y, por defecto, puede crecer hasta el 50% de la RAM física (≈ 4 GB) y tardar en devolverla. **Incompatible con R1+R3.**
- **TUI Windows (D3):** sin librería de TUI real: `read -p`, `printf` con ANSI y un spinner hecho a mano con `sleep`. No hay listas seleccionables con flechas sin dependencias adicionales (`fzf`, `gum`). mintty (Git Bash) renderiza bien ANSI; ejecutado desde PowerShell/`cmd` el comportamiento cambia. Bajo WSL hay además traducción de rutas (`/mnt/c/Users/...` vs `C:\Users\...`) y lentitud de E/S sobre NTFS, que choca con ADR-004.1 (carpetas bajo el perfil de usuario de Windows) y con los repos Git en disco Windows.
- **DevEx (D4):** **el punto más débil.** Sin tipos; manejo de errores basado en códigos de salida y `set -euo pipefail`, con trampas conocidas (errores silenciados en subshells y tuberías). Validar el JSON de Ollama contra un schema (ADR-003.1) con `jq` es posible solo de forma parcial y frágil. Tests con `bats-core`: existen, pero *mockear* `curl`/`git` implica sustituir binarios en el `PATH`. Escapado de texto libre de Jira (comillas, saltos de línea, acentos, UTF-8) al generar Markdown es fuente habitual de errores. Adecuado para un prototipo de 50 líneas, no para cuatro integraciones con fallbacks diferenciados.

**Veredicto frente a Node:** gana en D1/D2 (solo vía Git Bash), pierde claramente en D3 y D4. WSL queda descartado por R1/R2.

### 3.3. Java CLI (Picocli sobre la JVM)

- **Disco (D1):** los 4 proyectos backend son Spring Boot, por lo que es **probable** que la mayoría de puestos tenga un JDK, pero **no está garantizado ni homogéneo** (versión 8/11/17/21 según proyecto) y no forma parte de las restricciones confirmadas. Opciones: JDK completo (~300 MB), runtime recortado con `jlink` (~40–60 MB por puesto) o binario nativo con GraalVM `native-image` (~20–40 MB, pero el build en Windows exige Visual Studio Build Tools — varios GB — en la máquina de compilación). Añadir dependencias: Picocli, JLine3/Lanterna, Jackson, driver `sqlite-jdbc` (este último incluye binarios nativos para varias plataformas, ~10 MB).
- **RAM (D2):** una JVM para un CLI pequeño ronda **~60–150 MB RSS** incluso con `-Xmx` bajo (metaspace, JIT, hilos de GC). Es la opción más pesada en ejecución, **y la que compite con el mismo tipo de proceso** que ya satura el equipo (4 IDEs/herramientas JVM). Con `native-image` baja a ~20–40 MB.
- **TUI Windows (D3):** arranque en frío de la JVM ~0,5–1,5 s (percibible en una herramienta que debería sentirse instantánea — ADR-001.1); con `native-image`, decenas de ms. **Picocli resuelve el parsing de argumentos y colores ANSI, no la interacción**: prompts, listas y spinners requieren JLine3 (con Jansi/JNA para la consola de Windows) o Lanterna. Funciona, pero con más configuración y menos piezas "listas" que en Node o Go.
- **DevEx (D4):** tipado fuerte, `sealed interface` + *records* + *pattern matching* (Java 17/21) modelan bien el contrato de resultado; JUnit 5 + Mockito + WireMock es el ecosistema de testing más maduro de la lista. **Máxima familiaridad para los perfiles backend** del equipo. Contras: más ceremonia para un CLI pequeño, build con Maven/Gradle, y si se elige `native-image` aparecen los problemas de reflexión/configuración en tiempo de compilación.

**Veredicto frente a Node:** empata o gana en D4 (para el subequipo backend), pierde en D2 (JVM residente durante la ejecución, peor arranque) y en D1 (runtime no garantizado o toolchain nativa pesada). Es la alternativa **más sólida** si el equipo no tuviera Node.

### 3.4. PowerShell (nativo de Windows)

- **Disco (D1):** **Windows PowerShell 5.1 viene con el sistema (0 MB).** PowerShell 7 es una instalación aparte (~100–150 MB). SQLite no está integrado: requiere un módulo como PSSQLite o `System.Data.SQLite` con su DLL nativa.
- **RAM (D2):** `powershell.exe`/`pwsh.exe` arranca con el CLR/.NET cargado: **~60–120 MB RSS**, comparable o superior a Node, y con más variabilidad según el perfil del usuario y los módulos que se autoimporten.
- **TUI Windows (D3):** arranque ~0,5–1,5 s (carga de perfil y módulos). Integración nativa con la consola: `Read-Host`, `$Host.UI.PromptForChoice`, `Write-Progress`. Suficiente para confirmaciones, pobre para listas navegables o spinners concurrentes con el trabajo de red (requiere *jobs* o *runspaces*). Existen módulos de terceros (p. ej. PwshSpectreConsole sobre Spectre.Console) que mejoran mucho la TUI, pero **exigen PowerShell 7**, con lo que se pierde la ventaja de D1.
- **DevEx (D4):** `Invoke-RestMethod` convierte JSON en objetos automáticamente — muy cómodo para Jira/Ollama. **Pester** es un framework de tests con `Mock` nativo de *cmdlets*, sorprendentemente bueno. Pero: tipado dinámico (las clases de PS 5.1 son limitadas), manejo de errores confuso (errores *terminating* vs *non-terminating*, `$ErrorActionPreference`), y diferencias sutiles 5.1 ↔ 7. ⚠️ **Riesgo concreto para este producto:** en PS 5.1, `Out-File`/`Set-Content` usan por defecto UTF-16LE o la página de códigos ANSI, no UTF-8 sin BOM — un documento Markdown en español (tildes, `ñ`, `⚠️`) generado sin cuidado queda corrupto o con BOM. Curva de aprendizaje media: poco usado a diario por un equipo Java + Angular.

**Veredicto frente a Node:** gana en D1 solo si se queda en PS 5.1, pero entonces pierde en D3 y D4; con PS 7 pierde también la ventaja de disco. Sin beneficio neto.

### 3.5. Python (con Textual)

- **Disco (D1):** **Python no está instalado** (no figura entre las restricciones). Intérprete ~100–150 MB + entorno virtual con Textual/Rich/httpx/pydantic ~30–60 MB por puesto. Alternativa: empaquetar con PyInstaller/Nuitka (~20–40 MB por ejecutable), pero los ejecutables PyInstaller disparan **falsos positivos de antivirus** con frecuencia, lo que en un entorno corporativo es un bloqueo real de distribución. `sqlite3` viene en la biblioteca estándar (ventaja).
- **RAM (D2):** intérprete ~15–30 MB; una app Textual con su *event loop* y árbol de widgets ~50–100 MB, similar a Node + Ink.
- **TUI Windows (D3):** arranque ~0,5–1 s (importación de Textual/Rich). Textual renderiza muy bien en Windows Terminal; en `conhost` de Windows 10 la experiencia se degrada (colores, bordes y glifos). Además, **Textual es un framework de aplicaciones de pantalla completa**: para un flujo lineal de prompts + spinners es sobredimensionado (Rich + questionary encajarían mejor, con menos peso).
- **DevEx (D4):** tipado opcional (type hints + mypy/pyright) — más débil que TS porque no bloquea la ejecución y depende de disciplina. **Pydantic** es excelente para validar el JSON de Ollama (ADR-003.1). `pytest` + `respx`/`responses` + `unittest.mock`: testing muy cómodo. Curva de aprendizaje baja en sintaxis, pero **nadie del equipo lo usa a diario** según el PRD (Java + Angular), y la gestión de entornos en Windows (`py` launcher, venv, PATH) añade fricción de soporte en 5 puestos.

**Veredicto frente a Node:** comparable en D2/D4 técnico, pierde en D1 (runtime nuevo en todos los puestos) y en distribución (antivirus); sin ventaja que compense introducir un runtime más.

### 3.6. Go (compilado nativo, Bubble Tea / Charm)

- **Disco (D1):** **el mejor resultado para el puesto final**: un único `.exe` de ~10–20 MB sin runtime. El SDK de Go (~250–500 MB con caché de módulos) solo se necesita en la máquina que compila (o en CI). ⚠️ SQLite: `mattn/go-sqlite3` requiere **cgo + GCC en Windows** (MinGW/MSYS2, cientos de MB y fricción de build); `modernc.org/sqlite` es Go puro, evita el problema a costa de un binario algo mayor. Binario sin firmar → posibles avisos de SmartScreen/antivirus corporativo (mitigable firmando el ejecutable).
- **RAM (D2):** **~10–25 MB RSS**, la huella más baja de las opciones con TUI real. Nada residente.
- **TUI Windows (D3):** arranque en ~decenas de ms. Bubble Tea + Bubbles (spinners, listas, inputs) + Lip Gloss: ecosistema de TUI moderno con buen soporte de Windows Terminal y `conhost` con VT. `huh` (Charm) ofrece formularios/prompts lineales que encajan con el flujo del PRD sin llegar a pantalla completa.
- **DevEx (D4):** tipado estático y **errores como valores** (`if err != nil`), coherentes con la filosofía del contrato de resultado, aunque Go no tiene uniones discriminadas: `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante` se modela con interfaces + `type switch` **sin exhaustividad comprobada por el compilador** (se necesita un linter como `exhaustive`). Testing nativo (`go test`, tablas de casos, `httptest` para simular Jira/Ollama), *mocks* por interfaces. **Curva de aprendizaje real**: lenguaje nuevo para todo el equipo, y el modelo Elm (Model–Update–View) de Bubble Tea es un cambio de paradigma respecto a Spring y Angular. Además, invalida los contratos ya escritos en TypeScript en `002` §2.2 y en los tickets TK-01…TK-03.

**Veredicto frente a Node:** **gana en D1, D2 y D3**, pierde en D4 por curva de aprendizaje y coste de re-trabajo documental. Es la alternativa técnicamente más fuerte en eficiencia pura.

### 3.7. Consideración transversal — terminal de ejecución en Windows

Independientemente del lenguaje, los programas de consola **nativos de Windows** (Node, Go, Java, Python) pueden no detectar una TTY interactiva cuando se lanzan desde **mintty standalone** (la ventana clásica de Git Bash), porque mintty no es una consola Windows: los prompts interactivos fallan o se cuelgan si no se envuelven con `winpty`. Ejecutando la misma Git Bash **dentro de Windows Terminal** (ConPTY) el problema desaparece. Debe documentarse como requisito de uso, no como criterio diferencial entre stacks — afecta a todas las opciones salvo Bash puro.

---

## 4. Tabla Resumen Comparativa

Leyenda: 🟢 favorable · 🟡 aceptable con reservas · 🔴 desfavorable. Puntuación 1–5 (5 = mejor) por criterio.

| Tecnología | Impacto Disco (D1) | Consumo RAM (D2) | TUI Windows (D3) | DevEx / Mantenibilidad (D4) |
|---|---|---|---|---|
| **Node.js / TypeScript** | 🟢 **4** — runtime ya instalado; +30–80 MB de dependencias; riesgo de toolchain nativa si falta *prebuild* de `better-sqlite3` | 🟡 **3** — ~60–100 MB con Ink; ~40–60 MB sin Ink; nada residente | 🟢 **4** — arranque 150–400 ms; Ink/inquirer maduros en Windows; degradación ASCII en `conhost` | 🟢 **5** — TS `strict` con uniones discriminadas exhaustivas, Zod/Ajv, Vitest + msw; equipo ya usa TS (Angular) |
| **Bash + curl + jq** | 🟢 **5** (Git Bash, +~3 MB) / 🔴 **1** (WSL, 1–3 GB) | 🟢 **5** (Git Bash) / 🔴 **1** (WSL: `vmmem` hasta ~4 GB) | 🔴 **2** — sin prompts ni listas reales; spinners manuales; problemas de rutas bajo WSL | 🔴 **1** — sin tipos, errores por *exit code*, validación de schema frágil, escapado de texto de Jira propenso a errores |
| **Java CLI (Picocli)** | 🟡 **3** — JDK probable pero no garantizado ni homogéneo; `jlink` ~50 MB; `native-image` requiere VS Build Tools | 🔴 **2** — JVM ~60–150 MB, compite con 4 procesos JVM ya abiertos (~20–40 MB con `native-image`) | 🟡 **3** — arranque 0,5–1,5 s; interacción vía JLine3/Lanterna con más configuración | 🟢 **4** — *sealed interfaces*, JUnit/Mockito/WireMock; familiar para backend, ajeno al perfil Angular; más ceremonia |
| **PowerShell** | 🟢 **5** (5.1 nativo) / 🟡 **3** (PS 7, +100–150 MB) + módulo SQLite con DLL nativa | 🟡 **3** — ~60–120 MB (CLR + perfil) | 🟡 **2–3** — arranque 0,5–1,5 s; prompts nativos básicos; TUI rica solo con PS 7 + Spectre | 🔴 **2** — tipado dinámico, errores *terminating/non-terminating*, trampa UTF-16/ANSI en PS 5.1 para Markdown en español; Pester sí es bueno |
| **Python (Textual)** | 🔴 **2** — runtime nuevo 100–150 MB + venv 30–60 MB, o exe PyInstaller con falsos positivos AV | 🟡 **3** — ~50–100 MB con Textual | 🟡 **3** — arranque 0,5–1 s; excelente en Windows Terminal, degradado en `conhost`; Textual sobredimensionado para flujo lineal | 🟡 **3** — type hints opcionales, Pydantic y pytest excelentes; ningún miembro del equipo lo usa a diario |
| **Go (Bubble Tea)** | 🟢 **5** — `.exe` único 10–20 MB sin runtime; SDK solo en build; cgo a evitar (`modernc.org/sqlite`) | 🟢 **5** — ~10–25 MB | 🟢 **5** — arranque en decenas de ms; Bubble Tea/`huh` muy sólidos en Windows Terminal | 🟡 **3** — tipado estático y errores como valores, sin exhaustividad nativa; lenguaje y paradigma nuevos; invalida contratos TS ya escritos |

### 4.1. Puntuación ponderada

Pesos de §2: D1 20% · D2 20% · D3 25% · D4 35%. Para Bash y PowerShell se toma la variante más favorable (Git Bash; PS 5.1 con D3 = 2).

| Tecnología | D1 ×0,20 | D2 ×0,20 | D3 ×0,25 | D4 ×0,35 | **Total (/5)** |
|---|---|---|---|---|---|
| **Node.js / TypeScript** | 0,80 | 0,60 | 1,00 | 1,75 | **4,15** |
| Go (Bubble Tea) | 1,00 | 1,00 | 1,25 | 1,05 | **4,30** |
| Java CLI (Picocli) | 0,60 | 0,40 | 0,75 | 1,40 | **3,15** |
| PowerShell 5.1 | 1,00 | 0,60 | 0,50 | 0,70 | **2,80** |
| Python (Textual) | 0,40 | 0,60 | 0,75 | 1,05 | **2,80** |
| Bash + curl + jq (Git Bash) | 1,00 | 1,00 | 0,50 | 0,35 | **2,85** |

**Lectura:** Go y Node.js/TypeScript quedan en empate técnico (diferencia de 0,15 sobre 5, dentro del margen de error de estimaciones no medidas). El resto queda claramente por debajo. El desempate no lo decide la eficiencia de ejecución —donde Go gana, pero con un margen irrelevante frente al consumo de Ollama e IDEs (§1.2)— sino el **coste de adopción y mantenimiento por el propio equipo**, que es donde Node.js/TypeScript gana.

---

## 5. Conclusión y Recomendación Técnica

### 5.1. Decisión recomendada

**Se recomienda mantener Node.js / TypeScript** como stack de implementación de DevFlow CLI, ratificando `002-arquitectura-del-sistema.md` §2.3.

**Justificación frente a las restricciones reales:**

1. **Disco (R2):** es la única opción con TUI completa que **no añade ningún runtime** al puesto (R4). Go también lo consigue vía binario único, pero a cambio de introducir un lenguaje nuevo.
2. **RAM (R1, R3):** su huella (~40–100 MB, efímera) es mayor que la de Go pero **inferior a la de una JVM** y despreciable frente a los ~6–11 GB ya consumidos por los IDEs y los 2–4 GB de Ollama. No hay proceso residente.
3. **TUI (R5):** ecosistema de prompts y spinners probado masivamente en Windows por herramientas que el equipo ya usa a diario (Angular CLI).
4. **Mantenibilidad:** TypeScript es el único candidato que expresa **de forma nativa y con exhaustividad verificada por el compilador** el contrato `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante` sobre el que descansa toda la estrategia de resiliencia de ADR-001 §0, y los contratos ya están escritos en TS (`002` §2.2, TK-01…TK-03): cambiar de stack implicaría re-trabajo documental sin ganancia funcional.

### 5.2. Alternativas descartadas y condición de reapertura

| Alternativa | Motivo del descarte | Se reabriría si… |
|---|---|---|
| **Go** | Curva de aprendizaje de lenguaje + paradigma para 5 personas; re-trabajo de contratos. | La medición real (§5.3) muestra que el CLI en Node provoca paginación perceptible, o no es viable garantizar una versión de Node ≥ 20 en los puestos. **Es el plan B preferente.** |
| **Java CLI** | JVM adicional en equipos ya saturados de JVMs; arranque lento; runtime no garantizado. | El equipo decide compilar con GraalVM `native-image` en CI y la familiaridad backend pesa más que la huella. |
| **PowerShell** | TUI pobre en 5.1, tipado dinámico, riesgo de codificación del Markdown. | Nunca como herramienta principal; aceptable para un script de instalación/diagnóstico auxiliar. |
| **Python** | Runtime nuevo en todos los puestos; falsos positivos AV con PyInstaller; sin experiencia en el equipo. | — |
| **Bash + curl + jq** | Sin tipos ni TUI real; WSL inviable por RAM/disco. | — (válido solo para prototipos desechables). |

### 5.3. Condiciones de adopción (mitigaciones obligatorias)

Para que la recomendación sea válida con las restricciones de hardware, la implementación debe cumplir:

1. **Versión de Node verificada:** declarar `engines.node` y comprobar la versión al arrancar, con mensaje accionable si es inferior a la soportada. Inventariar la versión de Node real de los 5 puestos **antes** de iniciar TK-01.
2. **Cero compilación nativa en el puesto:** usar `node:sqlite` si la versión LTS elegida lo ofrece de forma estable; si se usa `better-sqlite3`, fijar una versión de Node con *prebuild* disponible para Windows x64. Nunca exigir Visual Studio Build Tools a los desarrolladores.
3. **Presupuesto de RAM del CLI:** objetivo ≤ 100 MB RSS en el pico de ejecución. Si Ink lo supera o su valor sobre `@inquirer/prompts` + spinner simple no compensa para un flujo lineal, evaluar prescindir de Ink (decisión a registrar en su propio ADR, no aquí).
4. **Medición real antes de cerrar este ADR:** ejecutar el flujo completo en un puesto representativo con IntelliJ + Data Studio abiertos y registrar RSS pico del CLI, RSS de Ollama con el modelo elegido, tiempo de arranque y fallos de página. Si el CLI supera el presupuesto del punto 3 de forma sistemática, reabrir con Go como plan B.
5. **Terminal soportada:** documentar Windows Terminal (con perfil PowerShell, CMD o Git Bash) como entorno soportado; mintty standalone requiere `winpty` (§3.7).
6. **Vigilancia de Ollama (fuera del alcance de este ADR):** el mayor consumidor de RAM del producto es el modelo local, no el CLI. Se recomienda que ADR-003.1 fije explícitamente un modelo pequeño cuantizado y un `keep_alive` corto para que Ollama libere la memoria tras cada ejecución, y que el timeout de fallback considere la lentitud de un equipo que ya pagina a disco.

### 5.4. Consecuencias

- 🟢 Cero runtime adicional en el puesto; contratos y tickets existentes siguen siendo válidos; un solo lenguaje (TypeScript) compartido con los proyectos Angular; exhaustividad del contrato de resultado verificada por el compilador.
- 🔴 Huella de RAM ~3–5× mayor que Go y arranque ~10× más lento (en ambos casos, magnitudes absolutas pequeñas); dependencia de la versión de Node del puesto; riesgo de compilación nativa si no se controla el driver SQLite — todos mitigados por §5.3.

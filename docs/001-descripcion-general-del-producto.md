## 1. Descripción general del producto

### **1.1. Objetivo:**

DevFlow CLI es una herramienta CLI/TUI para Windows 10/11 cuyo propósito es eliminar el cambio de contexto (*context switching*) que sufre un desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a Jira, la creación de la rama Git, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown.

Aporta valor a tres perfiles:

- **Desarrollador:** un solo comando reemplaza cuatro herramientas (Jira, terminal de Git, explorador de archivos y Google Drive); arranca a codear con la rama creada, la carpeta lista y el contexto del ticket ya resumido.
- **QA/Testing:** un documento de desarrollo con estructura idéntica en todos los tickets del mismo tipo (criterios de aceptación en Gherkin, objetos modificados y evidencias en una ubicación conocida).
- **DevOps:** un registro homogéneo y trazable de los objetos modificados por ticket y una checklist estandarizada de pasaje a producción.

Resuelve la falta de estandarización en la creación de ramas, carpetas y documentos, y la fricción de cambio de contexto entre Jira, Git, el explorador de archivos y Google Drive, para un equipo de 5 ingenieros que trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular).

### **1.2. Características y funcionalidades principales:**

Según el alcance del MVP definido en el PRD:

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Alta de una o más **claves de proyecto de Jira** (validadas contra Jira al darlas de alta), cada una con 0..N repositorios opcionales (nombre, ruta local y rama base, por defecto `main`), y de un **sufijo de usuario** para las ramas, sugerido a partir del nombre de la cuenta de Jira.
- Integración REST con Jira Cloud (API v2), autenticada con email + API Token (sin flujo OAuth con navegador). Ante fallo de red, token inválido/expirado o ticket inexistente, activa un modo fallback manual sin bloquear el flujo; como Jira Cloud responde 404 con un token inválido, ante un 404 la herramienta consulta `/myself` para distinguir ambos casos.
- `devflow start <ID>` inicia un ticket; `devflow start` sin ID lista los tickets abiertos asignados al usuario en sus claves (sin épicas) para elegir uno. Las épicas no generan rama ni documento: solo se avisa.
- Creación automática de la rama de Git con el formato `<prefijo>/<ID>-<SUFIJO>` (`features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`; el prefijo depende del tipo de issue), a partir de la rama base del repositorio previamente actualizada. Si hay cambios pendientes en el repositorio, la herramienta se detiene y los lista; nunca hace `commit`, `add` ni `push`.
- **Un repositorio por ejecución:** el desarrollador elige un repositorio de la lista de la clave. Si el ticket toca varios (backend y frontend, por ejemplo), se ejecuta una vez por cada uno, de forma secuencial; cada ejecución genera su propio documento y su carpeta de adjuntos, y el análisis de Ollama de la Fase 1 se genera una sola vez por ticket y se copia en el documento del siguiente repositorio. Una clave sin repositorios genera solo el documento, sin rama.
- Procesamiento con un LLM local (Ollama, modelo mínimo `qwen2.5:3b`) para autogenerar, a partir del texto crudo de Jira, la Descripción y Contexto, los Casos de Uso y los Criterios de Aceptación en formato Gherkin (*Given/When/Then*), con salida estructurada y un posprocesado que marca como "No especificado en el ticket" lo que el ticket no dice. Si Ollama no está disponible o no responde en 120 s, el flujo continúa igual: se genera el documento con el texto crudo sin estructurar, marcado para completar manualmente.
- Creación automática de la estructura de carpetas local por ticket y repositorio (`<raíz de tickets>\ID\<repositorio>\adjuntos\`), fuera del repositorio Git.
- Plantilla del documento en dos fases, con estructura idéntica por tipo de issue (bug o historia): **Fase 1** (generada automáticamente al crear el ticket: Descripción, Qué falla y Cómo reproducir en bugs o User Story en historias, Criterios de Aceptación en Gherkin, Casos de Uso y Preguntas abiertas) y **Fase 2** (completada por la desarrolladora durante el ciclo de vida del ticket: Datos del desarrollo —tablas, stored procedures, backend, frontend y otros—, Evidencias —pruebas unitarias y evidencias de funcionamiento— y Observaciones). La plantilla parte de la `plantilla-user-story.md` de la desarrolladora.

### **1.3. Diseño y experiencia de usuario:**

[![Demostración de DevFlow CLI (video de YouTube)](https://img.youtube.com/vi/i_tWna7VC9c/maxresdefault.jpg)](https://youtu.be/i_tWna7VC9c)

**Videotutorial:** [Demostración del flujo principal en YouTube](https://youtu.be/i_tWna7VC9c)

DevFlow CLI es solo de terminal, sin interfaz gráfica, así que la experiencia de usuario se muestra en un video de demostración: configuración inicial (`devflow config` y `devflow config proyectos`), inicio de una historia con `devflow start` (rama, carpeta de evidencias y documento generado con Ollama local), el documento con sus dos fases y un bug en una clave con dos repositorios, donde el programa pregunta en cuál trabajar. Los pasos se detallan en [`009-flujo-funcional.md`](009-flujo-funcional.md).

### **1.4. Instrucciones de instalación:**

Entorno de destino: **Windows 10/11**. El paquete es privado y no se publica en npm: se instala desde un clon del repositorio.

**Requisitos previos**

- **Node.js ≥ 22.13** (`node --version`). La herramienta no comprueba la versión al arrancar: la exigencia viene de `node:sqlite`, que no está disponible sin esa versión.
- **Git** en el `PATH`, con acceso al remoto `origin` de cada repositorio que vayas a configurar.
- **Ollama** instalado y activo (por defecto en `http://localhost:11434`), con el modelo mínimo `qwen2.5:3b`: `ollama pull qwen2.5:3b`. Solo con CPU, generar la Fase 1 de un ticket tarda entre 30 y 105 s; en equipos de 8 GB con varios IDEs abiertos puede ir más lento. Si Ollama no responde a tiempo, la herramienta no se detiene: genera el documento sin IA y lo avisa con `⚠️`.
- El **email** de tu cuenta de Jira y un **API Token** clásico (se crea en id.atlassian.com; un token *with scopes* no funciona contra `*.atlassian.net`).

**Instalación**

```text
git clone https://github.com/andrearocha-git/AI4Devs-finalproject.git
cd AI4Devs-finalproject
npm install
npm run build
npm link
devflow --help
```

`npm link` crea el comando global `devflow`, que apunta a esa carpeta: no la borres ni la muevas (`npm install -g .` crea el mismo enlace). Si `devflow` no se reconoce, abre una terminal nueva y comprueba que la carpeta global de npm (`npm prefix -g`) está en el `PATH`.

> Procedimiento verificado en WSL y en Windows 11 (PowerShell y `cmd`): `npm run build`, `npm link` y `devflow --help`. El uso completo (`devflow config`, `devflow config proyectos` y `devflow start`) se verificó a mano en Windows 11 el 2026-11-15 (issue #20), con Jira real en solo lectura, repositorios de prueba con `origin` local y el Ollama de WSL (servicio al que Windows llega por `localhost:11434`), en Windows PowerShell 5.1, `cmd` y Windows Terminal. Windows 10 entra en el criterio del producto (Windows 10/11), pero no se probó en esta entrega.

**Primer arranque**

1. `devflow config`: pide la URL de Jira, tu email, el API Token (se escribe enmascarado), la carpeta donde se guardarán los tickets (por defecto `%USERPROFILE%\DevFlowCLI\tickets`) y tu sufijo de rama (se sugiere desde tu nombre en Jira, por ejemplo `AROCHA`).
2. `devflow config proyectos`: da de alta las claves de proyecto de Jira y, opcionalmente, los repositorios de cada una (nombre, ruta local y rama base, `main` por defecto).
3. `devflow start [ID]`: prepara un ticket. Sin ID, muestra tus tickets asignados.

**Datos locales**

- La base de datos es `%APPDATA%\DevFlowCLI\devflow.db` (SQLite). **Se crea sola en el primer arranque y las migraciones se aplican solas**: no hay semillas de datos, ni servidor, ni frontend que levantar.
- Las carpetas y los documentos de cada ticket se guardan en la carpeta de tickets, **fuera** de tus repositorios.
- **El API Token se guarda en claro** en la columna `jira_api_token` de esa base (decisión del MVP, ver `002` §2.5): lo protegen solo los permisos de tu perfil de Windows. Si crees que se expuso, revócalo en Atlassian y vuelve a ejecutar `devflow config`.

**Actualizar**

`git pull`, `npm install` y `npm run build`; el comando enlazado usa el nuevo `dist/`.

**Si algo falla**

- *«Generado sin Ollama»*: Ollama está apagado o no tiene el modelo; comprueba `ollama list` y vuelve a ejecutar el ticket (la Fase 1 se reintenta sola).
- *Error al cargar `node:sqlite` nada más arrancar*: tu Node.js es anterior a 22.13. El mensaje lo emite Node, no DevFlow; comprueba `node --version` y actualiza.
- *Token inválido*: vuelve a ejecutar `devflow config` con un token nuevo.

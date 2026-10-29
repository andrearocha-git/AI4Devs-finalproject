## 5. Historias de Usuario

> Fuentes de verdad: `docs/PRD.md`, `docs/002-arquitectura-del-sistema.md`, `docs/003-modelo-de-datos.md`, `docs/ADR-001-arquitectura-inicial.md`. Redactadas bajo el marco INVEST: foco en valor de usuario, sin nombres de clases/componentes ni detalles internos de implementación. Lo no especificado en la documentación base se marca **(asumido)**; lo ambiguo o pendiente de definir se marca **(ambiguo)**. Reflejan las decisiones de la validación pre-código (ver ADR-007.1 y `docs/002-arquitectura-del-sistema.md`).

---

**US-01: Configuración inicial de claves de proyecto, repositorios y sufijo de usuario**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 1 | **Esfuerzo:** Medio
- **Dependencias Previas:** Ninguna

**COMO** desarrollador *(asumido: el PRD no define un rol distinto de "administrador" — cada desarrollador configura su propia instancia local)*

**QUIERO** dar de alta una o más claves de proyecto de Jira, asociarles opcionalmente mis repositorios locales (con su rama base) y fijar mi sufijo de usuario para las ramas

**PARA** que la herramienta sepa siempre con qué tickets y repositorios trabajar y cómo nombrar mis ramas, sin tener que indicárselo cada vez que inicio un ticket

**Criterios de Aceptación:**

1. GIVEN que es la primera vez que configuro la herramienta, WHEN doy de alta la clave de un proyecto de Jira, THEN la herramienta la valida contra Jira, AND guarda la clave con el nombre del proyecto, AND me confirma que quedó lista para usarse.
2. GIVEN que indico una clave que no existe en Jira, WHEN intento darla de alta, THEN la herramienta rechaza el alta, AND me explica el motivo; y si el rechazo se debe a que mi token no es válido, me lo indica en lugar de decir que la clave no existe.
3. GIVEN que una clave ya está dada de alta, WHEN le asocio un repositorio indicando su nombre (p. ej. `backend`), su ruta local y su rama base (por defecto `main`), THEN la herramienta verifica que la ruta sea un repositorio Git con remoto `origin` y que la rama base exista en el remoto, AND guarda el repositorio; si alguna verificación falla, rechaza el alta y me explica el motivo para que lo corrija. Una clave puede tener ninguno, uno o varios repositorios.
4. GIVEN que configuro mi sufijo de usuario por primera vez, WHEN la herramienta me propone uno a partir del nombre de mi cuenta de Jira (inicial del nombre más último apellido, sin acentos y en mayúsculas), THEN puedo confirmarlo o editarlo, AND la herramienta lo guarda para usarlo en todas mis ramas.
5. GIVEN que una clave o un repositorio ya están configurados, WHEN actualizo la ruta, la rama base u otro dato, THEN la herramienta reemplaza el valor anterior por el nuevo, AND no queda una configuración duplicada.
6. GIVEN que no he dado de alta ninguna clave de proyecto, WHEN intento iniciar un ticket, THEN la herramienta me indica que primero debo configurar al menos una clave.

---

**US-02: Selección y consulta de ticket de Jira con fallback manual**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo:** Medio
- **Dependencias Previas:** US-01

**COMO** desarrollador

**QUIERO** elegir de una lista mis tickets abiertos (o indicar el ID de uno) y que la herramienta obtenga automáticamente su título, su descripción y su tipo

**PARA** no tener que abrir el navegador ni copiar esa información manualmente cada vez que empiezo una tarea

**Criterios de Aceptación:**

1. GIVEN que tengo tickets abiertos asignados en mis claves de proyecto, WHEN inicio la herramienta sin indicar un ID, THEN la herramienta me muestra la lista de esos tickets (sin épicas) para que elija uno.
2. GIVEN que el ticket existe y hay conexión con Jira, WHEN lo inicio indicando su ID, THEN la herramienta obtiene automáticamente su título, su descripción y su tipo, AND continúa con la preparación del ticket sin pedirme nada más.
3. GIVEN que indico un ID cuya clave no está dada de alta, WHEN inicio el ticket, THEN la herramienta me avisa, antes de consultar a Jira, que esa clave no está configurada y me muestra las claves disponibles.
4. GIVEN que no hay conexión con Jira o mis credenciales no son válidas, WHEN inicio el ticket, THEN la herramienta me avisa del motivo (distinguiendo credenciales inválidas de falta de conexión), AND me permite ingresar manualmente el título y la descripción para continuar sin interrumpir mi trabajo.
5. GIVEN que el ID de ticket ingresado no existe en Jira, WHEN inicio el ticket, THEN la herramienta me informa que no encontró ese ticket, AND me ofrece cargar los datos manualmente para poder continuar.
6. GIVEN que el ticket es una épica, WHEN lo inicio, THEN la herramienta me avisa que las épicas no se usan para desarrollar y no tienen plantilla, AND no crea rama ni documento, invitándome a elegir una historia, tarea o bug.

---

**US-03: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo:** Alto
- **Dependencias Previas:** US-01, US-02

**COMO** desarrollador

**QUIERO** que la herramienta prepare en un solo paso, para el repositorio que elijo, la rama de trabajo, la carpeta de evidencias y el documento inicial del ticket

**PARA** empezar a trabajar de inmediato, sin ejecutar cada paso manualmente ni redactar el documento desde cero

**Criterios de Aceptación:**

1. GIVEN que ya tengo la información del ticket y el asistente de redacción local está disponible, WHEN elijo el repositorio y el ticket se inicia, THEN la herramienta crea la rama de trabajo —con el formato `<prefijo>/<ID>-<SUFIJO>` según el tipo de ticket— a partir de la rama base actualizada, sin modificar ningún archivo del proyecto, prepara la carpeta de evidencias en mi computadora, AND genera el documento inicial, de la plantilla que corresponde al tipo de ticket, ya redactado con el contexto, los casos de uso y los criterios de aceptación del ticket.
2. GIVEN que el repositorio elegido tiene cambios pendientes de commitear, WHEN inicio el ticket, THEN la herramienta se detiene antes de crear nada, AND me lista los cambios pendientes para que los resuelva y vuelva a ejecutar.
3. GIVEN que la rama base no se puede actualizar desde el remoto (sin red, historial divergente o credenciales de Git), WHEN inicio el ticket, THEN la herramienta se detiene con un error que explica el motivo, AND no crea la rama a partir de una base desactualizada.
4. GIVEN que el asistente de redacción local no está disponible en ese momento, WHEN inicio el ticket, THEN la herramienta igualmente crea la rama y la carpeta de evidencias, AND genera el documento con el contenido original del ticket sin redactar, avisándome con claridad que esa parte queda pendiente de completar.
5. GIVEN que la rama de ese ticket ya existe en ese repositorio, WHEN vuelvo a iniciar el mismo ticket, THEN la herramienta me informa que la rama ya existe, AND no crea una rama duplicada, continuando con la carpeta y el documento. *(ambiguo: la documentación base no especifica si la herramienta ofrece alguna acción adicional más allá de informar y continuar)*
6. GIVEN que el ticket requiere cambios en más de un repositorio y ya lo inicié con uno, WHEN lo inicio de nuevo y elijo el otro repositorio, THEN la herramienta genera una carpeta y un documento propios para ese repositorio, AND reutiliza el análisis ya redactado del ticket en lugar de volver a generarlo.
7. GIVEN que la clave del ticket no tiene repositorios asociados, WHEN inicio el ticket, THEN la herramienta genera únicamente el documento, sin crear rama ni ejecutar pasos de Git.
8. GIVEN que necesito partir de otra rama base solo para esta ejecución, WHEN inicio el ticket indicando esa rama, THEN la herramienta crea la rama desde ella, AND no cambia la rama base configurada del repositorio.

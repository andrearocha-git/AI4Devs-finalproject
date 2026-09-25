## 5. Historias de Usuario

> Fuentes de verdad: `docs/PRD.md`, `docs/002-arquitectura-del-sistema.md`, `docs/003-modelo-de-datos.md`, `docs/ADR-001-arquitectura-inicial.md`. Redactadas bajo el marco INVEST: foco en valor de usuario, sin nombres de clases/componentes ni detalles internos de implementación. Lo no especificado en la documentación base se marca **(asumido)**; lo ambiguo o pendiente de definir se marca **(ambiguo)**.

---

**US-01: Configuración inicial de repositorios y rutas locales**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 1 | **Esfuerzo:** Medio
- **Dependencias Previas:** Ninguna

**COMO** desarrollador *(asumido: el PRD no define un rol distinto de "administrador" — cada desarrollador configura su propia instancia local)*

**QUIERO** registrar una única vez la carpeta raíz de documentación y asociar cada proyecto con su repositorio local

**PARA** que la herramienta sepa siempre dónde trabajar, sin tener que indicárselo cada vez que inicio un ticket

**Criterios de Aceptación:**

1. Given que es la primera vez que configuro un proyecto, When registro su repositorio local y la carpeta raíz de documentación, Then la herramienta guarda esa configuración, And me confirma que el proyecto quedó listo para usarse.
2. Given que indico una carpeta o repositorio que no existe o al que no tengo acceso, When intento guardar esa configuración, Then la herramienta rechaza el registro, And me explica el motivo para que lo corrija. *(ambiguo: la documentación base no especifica si esta validación ocurre en el momento de configurar o recién en el primer uso del repositorio)*
3. Given que un proyecto ya está configurado, When actualizo la ruta de su repositorio u otro dato de la configuración, Then la herramienta reemplaza el valor anterior por el nuevo, And no queda una configuración duplicada para el mismo proyecto.

---

**US-02: Consulta automática de ticket de Jira con fallback manual**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo:** Medio
- **Dependencias Previas:** US-01

**COMO** desarrollador

**QUIERO** que la herramienta obtenga automáticamente el título y la descripción del ticket a partir de su ID de Jira

**PARA** no tener que abrir el navegador ni copiar esa información manualmente cada vez que empiezo una tarea

**Criterios de Aceptación:**

1. Given que el ticket existe y hay conexión con Jira, When inicio el ticket indicando su ID, Then la herramienta obtiene automáticamente su título y descripción, And continúa con la preparación del ticket sin pedirme nada más.
2. Given que no hay conexión con Jira o mis credenciales no son válidas, When inicio el ticket, Then la herramienta me avisa que no pudo obtener la información de Jira, And me permite ingresar manualmente el título y la descripción para continuar sin interrumpir mi trabajo.
3. Given que el ID de ticket ingresado no existe en Jira, When inicio el ticket, Then la herramienta me informa que no encontró ese ticket, And me ofrece cargar los datos manualmente para poder continuar. *(ambiguo: no está definido si en este caso conviene permitir la carga manual o pedir primero que se corrija el ID)*

---

**US-03: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**

- **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo:** Alto
- **Dependencias Previas:** US-01, US-02

**COMO** desarrollador

**QUIERO** que la herramienta prepare en un solo paso la rama de trabajo, la carpeta de evidencias y el documento inicial del ticket

**PARA** empezar a trabajar de inmediato, sin ejecutar cada paso manualmente ni redactar el documento desde cero

**Criterios de Aceptación:**

1. Given que ya tengo la información del ticket y el asistente de redacción local está disponible, When inicio el ticket, Then la herramienta crea la rama de trabajo sin modificar ningún otro archivo del proyecto, prepara la carpeta de evidencias en mi computadora, And genera el documento inicial ya redactado con el contexto, los casos de uso y los criterios de aceptación del ticket.
2. Given que el asistente de redacción local no está disponible en ese momento, When inicio el ticket, Then la herramienta igualmente crea la rama y la carpeta de evidencias, And genera el documento con el contenido original del ticket sin redactar, avisándome con claridad que esa parte queda pendiente de completar.
3. Given que la rama de ese ticket ya fue creada anteriormente, When vuelvo a iniciar el mismo ticket, Then la herramienta me informa que la rama ya existe, And no crea una rama duplicada, dejando en mí la decisión de cómo continuar. *(ambiguo: la documentación base no especifica si la herramienta ofrece alguna acción adicional más allá de informarme)*

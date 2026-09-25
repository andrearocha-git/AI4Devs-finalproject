## Índice

0. [Ficha del proyecto](#0-ficha-del-proyecto)
1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## 0. Ficha del proyecto

### **0.1. Tu nombre completo:**

### **0.2. Nombre del proyecto:**

### **0.3. Descripción breve del proyecto:**

### **0.4. URL del proyecto:**

> Puede ser pública o privada, en cuyo caso deberás compartir los accesos de manera segura. Puedes enviarlos a [alvaro@lidr.co](mailto:alvaro@lidr.co) usando algún servicio como [onetimesecret](https://onetimesecret.com/).

### 0.5. URL o archivo comprimido del repositorio

> Puedes tenerlo alojado en público o en privado, en cuyo caso deberás compartir los accesos de manera segura. Puedes enviarlos a [alvaro@lidr.co](mailto:alvaro@lidr.co) usando algún servicio como [onetimesecret](https://onetimesecret.com/). También puedes compartir por correo un archivo zip con el contenido


---

## 1. Descripción general del producto

> Describe en detalle los siguientes aspectos del producto:

### **1.1. Objetivo:**

> Propósito del producto. Qué valor aporta, qué soluciona, y para quién.

### **1.2. Características y funcionalidades principales:**

> Enumera y describe las características y funcionalidades específicas que tiene el producto para satisfacer las necesidades identificadas.

### **1.3. Diseño y experiencia de usuario:**

> Proporciona imágenes y/o videotutorial mostrando la experiencia del usuario desde que aterriza en la aplicación, pasando por todas las funcionalidades principales.

### **1.4. Instrucciones de instalación:**
> Documenta de manera precisa las instrucciones para instalar y poner en marcha el proyecto en local (librerías, backend, frontend, servidor, base de datos, migraciones y semillas de datos, etc.)

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**
> Usa el formato que consideres más adecuado para representar los componentes principales de la aplicación y las tecnologías utilizadas. Explica si sigue algún patrón predefinido, justifica por qué se ha elegido esta arquitectura, y destaca los beneficios principales que aportan al proyecto y justifican su uso, así como sacrificios o déficits que implica.


### **2.2. Descripción de componentes principales:**

> Describe los componentes más importantes, incluyendo la tecnología utilizada

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

> Representa la estructura del proyecto y explica brevemente el propósito de las carpetas principales, así como si obedece a algún patrón o arquitectura específica.

### **2.4. Infraestructura y despliegue**

> Detalla la infraestructura del proyecto, incluyendo un diagrama en el formato que creas conveniente, y explica el proceso de despliegue que se sigue

### **2.5. Seguridad**

> Enumera y describe las prácticas de seguridad principales que se han implementado en el proyecto, añadiendo ejemplos si procede

### **2.6. Tests**

> Describe brevemente algunos de los tests realizados

---

## 3. Modelo de Datos

### **3.1. Diagrama del modelo de datos:**

> Recomendamos usar mermaid para el modelo de datos, y utilizar todos los parámetros que permite la sintaxis para dar el máximo detalle, por ejemplo las claves primarias y foráneas.


### **3.2. Descripción de entidades principales:**

> Recuerda incluir el máximo detalle de cada entidad, como el nombre y tipo de cada atributo, descripción breve si procede, claves primarias y foráneas, relaciones y tipo de relación, restricciones (unique, not null…), etc.

---

## 4. Especificación de la API

> Si tu backend se comunica a través de API, describe los endpoints principales (máximo 3) en formato OpenAPI. Opcionalmente puedes añadir un ejemplo de petición y de respuesta para mayor claridad

---

## 5. Historias de Usuario

> Documenta 3 de las historias de usuario principales utilizadas durante el desarrollo, teniendo en cuenta las buenas prácticas de producto al respecto.

> Detalle completo (criterios de aceptación Given/When/Then/And) en [`docs/005-historias-de-usuario.md`](docs/005-historias-de-usuario.md).

**Historia de Usuario 1: Configuración inicial de repositorios y rutas locales**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Como desarrollador, quiero registrar una única vez la carpeta raíz de documentación y asociar cada proyecto con su repositorio local, para que la herramienta sepa siempre dónde trabajar sin tener que indicárselo cada vez que inicio un ticket.

**Historia de Usuario 2: Consulta automática de ticket de Jira con fallback manual**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Medio · Dependencias: US-01*

Como desarrollador, quiero que la herramienta obtenga automáticamente el título y la descripción del ticket a partir de su ID de Jira, para no tener que abrir el navegador ni copiar esa información manualmente; si la consulta falla, quiero poder cargar los datos a mano y seguir trabajando sin interrupciones.

**Historia de Usuario 3: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Alto · Dependencias: US-01, US-02*

Como desarrollador, quiero que la herramienta prepare en un solo paso la rama de trabajo, la carpeta de evidencias y el documento inicial del ticket, para empezar a trabajar de inmediato sin ejecutar cada paso manualmente ni redactar el documento desde cero.

---

## 6. Tickets de Trabajo

> Documenta 3 de los tickets de trabajo principales del desarrollo, uno de backend, uno de frontend, y uno de bases de datos. Da todo el detalle requerido para desarrollar la tarea de inicio a fin teniendo en cuenta las buenas prácticas al respecto. 

> Detalle técnico completo (archivos, contratos, criterios de aceptación técnicos y Definition of Done) en [`docs/006-tickets-de-trabajo.md`](docs/006-tickets-de-trabajo.md).

**Ticket 1 (Base de Datos) — TK-01: Implementación del Esquema SQLite (DDL) y del módulo SQLite Storage Manager**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Crea las tablas `app_config`, `projects_config` y `ticket_logs` (con sus constraints e índices), el sistema de migraciones versionadas, y el módulo que centraliza todo el acceso a SQLite — único componente del sistema que lee/escribe la base de datos. Vinculado a US-01, US-02 y US-03.

**Ticket 2 (Backend / Servicios) — TK-02: Implementación de Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Alto · Dependencias: TK-01*

Implementa la consulta directa a Jira (con reintento y clasificación de fallos), el procesamiento con Ollama (con validación de esquema y fallback determinista sin código generado), la creación mínima de la rama Git (sin tocar nada más del repositorio) y la generación de la carpeta de evidencias y el documento Markdown en dos fases, todo coordinado por un orquestador que emite eventos de progreso. Vinculado a US-02 y US-03.

**Ticket 3 (Frontend / TUI) — TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Medio · Dependencias: TK-01, TK-02*

Implementa el comando `devflow start <ID>`, la validación del ID, los prompts de carga manual y confirmación, y las vistas de progreso, resumen y fallback en la terminal — la TUI nunca accede a Jira, Git, Ollama o SQLite directamente, solo al orquestador. Vinculado a US-01, US-02 y US-03.

---

## 7. Pull Requests

> Documenta 3 de las Pull Requests realizadas durante la ejecución del proyecto

**Pull Request 1**

**Pull Request 2**

**Pull Request 3**


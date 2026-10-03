# SCRUM-2 — El botón Aceptar desaparece al actualizar el campo Importe

| Campo | Valor |
|---|---|
| Tipo | Error |
| Repositorio | backend |
| Rama | `bugs/SCRUM-2-AROCHA` |
| Jira | https://andreardev.atlassian.net/browse/SCRUM-2 |
| Iniciado | 2026-10-03 |
| Fase 1 generada con | qwen2.5:3b · prompt `bug-v3` |

<!-- DEVFLOW:FASE1:INICIO — DevFlow CLI regenera esta sección al reprocesar el ticket; los cambios hechos aquí se pierden -->
## Fase 1 — Análisis del bug

### Resumen

El botón Aceptar desaparece al actualizar el campo Importe en la pantalla de Facturas.

### Pasos para reproducir

1. Ingresar a Facturas
1. Seleccionar una Factura específica
1. Presionar Editar
1. Borrar el valor del campo Importe
1. Presionar Aceptar

### Comportamiento esperado

No especificado en el ticket.

### Comportamiento actual

El botón Aceptar desaparece al borrar el importe, no se muestra en la pantalla.

### Entorno

No especificado en el ticket.

### Criterios de aceptación (verificación de la corrección)

```gherkin
Scenario: Verificación de presencia del botón Aceptar
  Given La aplicación está en estado de edición de una Factura con un importe presente
  When Se intenta borrar el valor del campo Importe y luego presionar Aceptar
  Then El botón Aceptar debe permanecer visible y funcional
```

### Preguntas abiertas

- [ ] ¿Cuál es el comportamiento esperado?
- [ ] ¿En qué ambiente y versión ocurre?
- [ ] ¿Qué pasa si se presiona Cancelar en lugar de Aceptar después de borrar el importe?
- [ ] ¿Se muestra algún mensaje de error al intentar borrar el importe?
- [ ] ¿El botón Aceptar reaparece automáticamente una vez que se vuelve a introducir un valor en el campo Importe?
<!-- DEVFLOW:FASE1:FIN -->

## Fase 2 — Corrección y pasaje a producción

_Esta sección la completa el desarrollador durante el ciclo de vida del ticket. DevFlow CLI no la modifica._

### Causa raíz

_¿Por qué ocurría el fallo?_

### Solución aplicada

### Objetos modificados

| Archivo / objeto | Tipo de cambio | Descripción |
|---|---|---|
| | | |

### Evidencias de pruebas

Adjuntar capturas, logs y archivos en [`adjuntos/`](./adjuntos/).

| Prueba | Antes de la corrección | Después de la corrección |
|---|---|---|
| Reproducción del bug | | |

### Pruebas de regresión

- [ ]

### Instrucciones de pasaje a producción

1.

**Rollback:**

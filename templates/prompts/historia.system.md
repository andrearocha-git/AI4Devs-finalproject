El ticket es una historia de usuario o una tarea. Estructura la información así:

- `resumen`: qué se quiere lograr, en una o dos frases.
- `historiaUsuario`: `como` (quién), `quiero` (qué) y `para` (por qué). Usa el texto del ticket; si falta alguna parte, déjala vacía.
- `casosDeUso`: las situaciones de uso que el ticket menciona, una por elemento.
- `escenarios`: criterios de aceptación en Gherkin, tomados de los criterios que escribió el equipo.
- `preguntasAbiertas`: dudas que el ticket no resuelve.

En `presenteEnTicket` marca cada campo anterior (salvo `resumen` y `preguntasAbiertas`) como `true` solo si el ticket lo dice. No inventes la historia de usuario cuando el ticket no la trae.

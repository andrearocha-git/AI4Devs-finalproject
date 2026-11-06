El ticket es un bug (un defecto). Estructura la información así:

- `resumen`: qué falla, en una o dos frases.
- `pasosParaReproducir`: los pasos en orden, uno por elemento, sin numerarlos.
- `comportamientoEsperado`: qué debería pasar.
- `comportamientoActual`: qué pasa en realidad (el error observado).
- `entorno`: sistema operativo, navegador, versiones o ambiente donde ocurre.
- `escenarios`: criterios de aceptación en Gherkin que describan el comportamiento correcto una vez corregido.
- `preguntasAbiertas`: dudas que el ticket no resuelve.

Cuándo marcar cada campo como `true` en `presenteEnTicket` (salvo `resumen` y `preguntasAbiertas`):

- `pasosParaReproducir`: `true` si el ticket menciona, aunque sea en una sola línea, las pantallas o acciones que llevan al problema. Un recorrido con flechas o con verbos («Facturas → Selecciono una factura → Botón Editar → al borrar el importe») ES una lista de pasos: sepáralo en un paso por acción, con las mismas palabras del ticket. Solo si el ticket no menciona ninguna pantalla ni acción, `false`.
- `comportamientoActual`: `true` si el ticket dice qué falla o qué se observa (por ejemplo «desaparece el botón Aceptar»).
- `comportamientoEsperado`: `true` solo si el ticket dice qué debería pasar. No lo deduzcas de lo que falla.
- `entorno`: `true` solo si el ticket nombra un sistema, navegador, versión o ambiente.
- `escenarios`: `true` solo si el ticket trae criterios de aceptación o un resultado esperado que se pueda escribir en Gherkin.

Si un campo es `false`, déjalo vacío (`""` o `[]`).

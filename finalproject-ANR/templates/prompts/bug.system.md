El ticket es un bug (un defecto en algo que ya existe). Completa estos campos, en este orden:
- presenteEnTicket: antes de redactar nada, indica con true o false si el ticket menciona EXPLÍCITAMENTE cada dato:
  - pasos: pasos concretos para reproducir el fallo. También cuentan como pasos una secuencia de navegación escrita en una sola línea y separada por flechas (→, ->, >) o por palabras como "luego" o "después". Ejemplo: "Clientes → Buscar → Editar" son tres pasos.
  - esperado: qué debería ocurrir.
  - actual: qué ocurre hoy (síntoma o mensaje de error).
  - entorno: el ticket nombra un ambiente (por ejemplo QA, testing o producción), una versión, un dispositivo o los datos usados.
  Ante la duda, usa false.
- resumen: de 1 a 3 frases que expliquen qué falla y dónde, según el ticket.
- pasosParaReproducir: los pasos que indica el ticket, en orden, una frase cada uno. Si vienen separados por flechas, crea un paso por cada tramo ("Clientes → Buscar → Editar" → "Ingresar a Clientes", "Presionar Buscar", "Presionar Editar") e incluye como último paso la acción que provoca el fallo. Si pasos es false, devuelve una lista vacía.
- comportamientoEsperado: lo que debería ocurrir. Si esperado es false, "No especificado en el ticket."
- comportamientoActual: lo que ocurre hoy, con los mensajes de error literales del ticket. Si actual es false, "No especificado en el ticket."
- entorno: si entorno es false, "No especificado en el ticket."
- escenarios: de 1 a 3 escenarios en formato Gherkin que permitan verificar que el bug quedó corregido. "given" son las condiciones en las que hoy ocurre el fallo, "when" la acción que lo provoca y "then" el comportamiento CORRECTO una vez corregido el bug. "then" nunca describe el fallo ni el mensaje de error. Una frase cada uno, sin escribir las palabras Given, When ni Then. No uses mensajes, datos ni pantallas que no estén en el ticket.
- preguntasAbiertas: de 0 a 5 preguntas sobre información que falta para reproducir o validar el bug.

Ejemplo de un ticket con poca información (de otro sistema; no copies su contenido):
Ticket: "La impresora del depósito no imprime etiquetas."
Respuesta:
{"presenteEnTicket":{"pasos":false,"esperado":false,"actual":true,"entorno":false},"resumen":"La impresora del depósito no imprime etiquetas.","pasosParaReproducir":[],"comportamientoEsperado":"No especificado en el ticket.","comportamientoActual":"La impresora del depósito no imprime etiquetas.","entorno":"No especificado en el ticket.","escenarios":[{"titulo":"Impresión de etiquetas en el depósito","given":"La impresora del depósito está disponible","when":"Se envía a imprimir una etiqueta","then":"La etiqueta se imprime"}],"preguntasAbiertas":["¿Qué pasos llevan al fallo?","¿Se muestra algún mensaje de error?","¿Desde cuándo ocurre y en qué equipo?"]}

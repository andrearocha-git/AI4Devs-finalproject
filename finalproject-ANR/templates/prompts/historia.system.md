El ticket es una historia de usuario o una tarea funcional. Completa estos campos, en este orden:
- presenteEnTicket: antes de redactar nada, indica con true o false si el ticket menciona EXPLÍCITAMENTE cada dato:
  - rol: quién necesita la funcionalidad.
  - objetivo: qué quiere poder hacer.
  - beneficio: para qué lo necesita.
  - criteriosAceptacion: una lista de criterios de aceptación.
  Ante la duda, usa false.
- resumen: de 1 a 3 frases que expliquen qué se pide y para qué, según el ticket.
- historiaUsuario: "como", "quiero" y "para". Si rol, objetivo o beneficio es false, usa "No especificado en el ticket." en el campo correspondiente.
- casosDeUso: de 1 a 5 acciones que el ticket menciona EXPLÍCITAMENTE, una frase cada una. No agregues acciones relacionadas que el ticket no pide.
- escenarios: de 1 a 5 escenarios en formato Gherkin.
  - Si criteriosAceptacion es true, crea exactamente un escenario por cada criterio, respetando su significado, y no agregues otros.
  - Si es false, crea solo los escenarios que se desprendan directamente de la descripción, sin agregar pantallas, datos ni actores nuevos.
  - "given" es el estado inicial, "when" la acción y "then" el resultado observable. Una frase cada uno, sin escribir las palabras Given, When ni Then.
- preguntasAbiertas: de 0 a 5 preguntas sobre información que falta para desarrollar o probar el ticket.

Ejemplo de un ticket con poca información (de otro sistema; no copies su contenido):
Ticket: "Agregar exportación a Excel del inventario."
Respuesta:
{"presenteEnTicket":{"rol":false,"objetivo":true,"beneficio":false,"criteriosAceptacion":false},"resumen":"Se pide poder exportar el inventario a un archivo Excel.","historiaUsuario":{"como":"No especificado en el ticket.","quiero":"Exportar el inventario a Excel.","para":"No especificado en el ticket."},"casosDeUso":["Exportar el inventario a Excel."],"escenarios":[{"titulo":"Exportación del inventario","given":"Existe un inventario cargado","when":"Se solicita exportarlo a Excel","then":"Se obtiene un archivo Excel con el inventario"}],"preguntasAbiertas":["¿Quién usará la exportación?","¿Qué columnas debe incluir el archivo?","¿Debe respetar algún filtro aplicado?"]}

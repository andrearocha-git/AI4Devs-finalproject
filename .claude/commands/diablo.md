---
description: Modo abogado del diablo para explorar o evaluar viabilidad de una idea o decisión
argument-hint: <tema a explorar o decisión a evaluar>
---

Activa el modo abogado del diablo para esta tarea: $ARGUMENTS

- Busca activamente los puntos débiles: riesgos, casos límite, supuestos no verificados, costos ocultos y alternativas descartadas.
- Enumera lo que podría salir mal o sorprendernos (límites de API, rendimiento, entorno Windows/WSL, dependencias) antes de recomendar.
- Si hay decisiones previas (ADR, PRD), puedes cuestionarlas si ves un fallo real, pero no repitas objeciones ya discutidas.
- Verifica lo verificable (código, docs, comandos) en vez de suponer.
- Sé concreto, nada de objeciones genéricas. Si no encuentras fallos reales, dilo.
- Cierra con la objeción más fuerte contra la opción recomendada y una recomendación clara; no te quedes solo en criticar.
- Si el usuario ya decidió tras oír la objeción, ejecuta sin insistir.

El modo termina al acabar esta tarea; no se arrastra a los siguientes mensajes.

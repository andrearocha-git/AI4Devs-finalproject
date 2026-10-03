# Ejemplos de salida

Documentos generados de punta a punta (fixture de `../tickets/` → prompt → Ollama → posprocesado → plantilla) que sirven de **referencia** de cómo debe quedar un documento.

**No son "golden files" para comparar texto exacto:** la salida del LLM varía entre ejecuciones. Sirven para revisar la estructura y para comparar a ojo cuando se cambia un prompt o una plantilla.

| Ejemplo | Entrada | Generado con | Problemas conocidos |
|---|---|---|---|
| `bug-real-scrum2.md` | `../tickets/bug-real-scrum2.json` (ticket real SCRUM-2, pasos con flechas) | `qwen2.5:3b` · prompt `bug-v3` · 2026-10-03 | Paso 5 "Presionar Aceptar" sobra (el botón es el que desaparece) y el `When` lo arrastra; falta el paso "se abre el popup Modificar Factura" |

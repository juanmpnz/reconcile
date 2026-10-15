# Documentos: operación y límites

Contrato de diseño: ADR 0004. La evidencia de implementación y pruebas vigente se registra en docs/status.md y en la tarea document-foundation.

## Desarrollo

Usar los mismos PostgreSQL, Redis y bucket privado del entorno local. Tras actualizar el código: `pnpm install`, `pnpm db:migrate`, `pnpm dev`. El proceso worker debe seguir activo para extraer documentos; cerrar el worker no elimina la intención pendiente de PostgreSQL. No borrar volúmenes para resolver un fallo de procesamiento.

El upload inicial es PDF de hasta 10 MiB. El cliente envía bytes `application/pdf`, nombre y clase mediante el contrato compartido. No se aceptan URLs remotas. No existe conexión con CargoWise ni proveedor de IA externo.

El motor inicial lee texto embebido con PDF.js; no hace OCR ni reconoce universalmente tablas de navieras. Máximo 50 páginas, 200.000 caracteres y 10 segundos en el hilo de parsing, con límite de heap administrado. Un hilo no es un sandbox de sistema operativo ni un límite de memoria nativa total. Escaneos, archivos cifrados y fallos quedan explícitos, con códigos de error sin contenido documental en logs.

La extracción etiquetada busca Provider/Proveedor, Document number/Número de documento, Operation reference/Referencia de operación, Date/Fecha, Currency/Moneda y Total. Datos ausentes/conflictivos se revisan. Los resultados no se consideran aprobaciones contables. Las correcciones conservan autor, motivo y vínculo a la ejecución original.

## Recuperación

PostgreSQL es la fuente de verdad. Cada carga/reintento registra la ejecución e intención de trabajo en la misma transacción. Redis transporta identificadores. El despachador reconcilia ejecuciones no terminales, incluyendo trabajos perdidos tras publicarse; no confiar únicamente en la deduplicación de BullMQ. El identificador de lease impide que un procesador antiguo sobrescriba el resultado de otro.

Si Redis o el worker no están disponibles, conservar base y originales, restablecer los servicios y observar los estados; no crear manualmente filas ni editar resultados para simular éxito. Los reintentos explícitos requieren un usuario con permisos vigentes y generan una nueva ejecución. Un iniciador que perdió permisos puede bloquear el trabajo pendiente.

S3 y PostgreSQL no son una transacción distribuida. Se compensa una carga fallida cuando es posible, pero una caída entre guardar bytes y confirmar metadatos puede dejar objetos huérfanos. No hay recolector automático en esta entrega: antes de borrar, inventariar objetos y contrastar claves con metadatos, preservar respaldo y aplicar una retención acordada. No ejecutar borrados indiscriminados del bucket.

## Referencias de implementación consultadas

- PDF.js API: https://mozilla.github.io/pdf.js/api/draft/api.js.html
- AWS SDK v3, S3: https://docs.aws.amazon.com/es_es/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html
- BullMQ idempotencia: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ identificadores y efecto de borrar jobs: https://docs.bullmq.io/guide/jobs/job-ids

No afirmar disponibilidad para documentos reales hasta completar MFA, política de retención, límites operativos, seguridad, backups y restauración del despliegue previsto.

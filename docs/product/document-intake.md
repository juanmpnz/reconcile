# Entrega documental: aceptación de fase 2

Decisión de producto previa a implementación, 15 octubre 2026. Responsable secuencial: /root (producto y dominio); no sustituye validación del experto de la empresa.

El operador entra en una organización, carga un PDF y ve su estado en una tabla. Puede consultar el original privado, revisar texto/campos con su página de origen y corregir datos conservando el resultado original y el motivo. Propietario, administrador y analista pueden cargar/corregir; lector consulta. El servidor verifica membresía vigente en cada recurso.

Los indicadores de espera se limitan a la acción pendiente: sesión inicial, primera consulta, actualización y botones. Una actualización conserva filas autorizadas visibles; una comprobación de acceso pendiente no muestra información protegida del caché. No hay porcentajes inventados ni animación obligatoria.

Campos iniciales: proveedor, número de documento, referencia de operación, fecha, moneda y total. La extracción es real sobre bytes PDF, con alcance limitado declarado; campos ausentes o ambiguos requieren revisión. Un PDF escaneado sin texto requiere OCR aún no disponible y no se muestra como procesado correctamente. El usuario conserva acceso al original. Las correcciones no convierten datos inciertos en una aprobación financiera.

El expediente sintético comprende factura del carrier (150 USD servicio base +62 USD recogida), factura del transportista (62 USD), acuerdo del carrier que excluye recogida y registro operativo que asigna esa misma recogida al transportista. Nombres, códigos, fechas y referencias son ficticios; ningún precio procede de una tarifa comercial real. El acuerdo externo no se confunde con el coste estimado interno. La coincidencia de nombre no demuestra doble cobro: una recogida de otro tramo será un caso negativo del motor de fase 3.

Esta entrega prepara evidencia y datos; no emite todavía hallazgos, reclamos, posteo ni pagos. El resultado esperado del caso de 62 USD vive separado de los documentos de entrada y no se entrega al extractor.

Aceptación negativa: acceso cruzado/revocado denegado; lector no modifica; archivo inválido o demasiado grande rechazado; duplicados no crean registros repetidos; error de extracción visible; reintentos no duplican efectos. Los trabajos de negocio requieren intención durable en PostgreSQL y recuperación ante indisponibilidad de Redis. La revisión debe distinguir pruebas HTTP reales de fixtures de navegador.

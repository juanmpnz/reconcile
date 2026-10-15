# Revisión humana y reclamos — aceptación de fase 4

Fecha: 2026-10-15. Definición previa a implementación por `/root/analysis_product_domain`, roles product-manager y logistics-domain. Fuentes: AGENTS/workflow, perfiles, requisitos del piloto y fases 4–5 del plan. La definición no acredita validación empresarial ni funciones ya implementadas.

## Resultado y frontera

Recorrido mínimo: revisar hallazgo y fuentes → registrar decisión con motivo → preparar un borrador editable → descargar texto y expediente trazable → registrar manualmente envío/respuesta/cierre y próxima fecha de seguimiento. La aplicación no envía emails, no busca destinatarios, no aprueba facturas, no registra pagos ni postea en sistemas externos. El estado del reclamo y el resultado de análisis son independientes del estado contable.

El caso demo de 62 USD debe poder producir un borrador de solicitud de corrección/abono, **solo después de confirmar explícitamente el hallazgo**. La mera resta de totales o la finalización del job no crea ni confirma un reclamo.

## Decisiones de revisión

Confirmar hallazgo, desestimar hallazgo y aceptar diferencia requieren motivo no vacío, actor, fecha y pertenencia vigente con permiso de escritura. El lector puede consultar fuentes, decisiones y reclamos; no modifica ni exporta como acción de negocio si esa exportación crea una versión/estado.

La revisión humana usa su propia versión de concurrencia y no incrementa la revisión de datos fuente de la operación por el mero hecho de confirmar: confirmar un hallazgo no debe volver obsoleto el análisis recién revisado. Las decisiones son eventos append-only ligados a organización, operación, ejecución inmutable, índice exacto del hallazgo y su identidad de fuente validada en servidor. Un índice fuera de rango, ejecución ajena/no completada, fingerprint desactualizado o versión de decisión concurrente se rechaza; el cliente no envía importes, proveedor o evidencia para sustituir los del hallazgo. Cambiar de decisión añade historial, no borra el motivo anterior. Confirmar significa que una persona considera el hallazgo revisable/reclamable dentro de su alcance; no acredita que el proveedor lo haya aceptado ni que haya ocurrido un ahorro.

Desestimar no equivale a aceptar un cargo; aceptar diferencia registra una decisión humana y su explicación, sin convertir el precio o servicio en automáticamente correcto. Los hallazgos coincidentes no generan cobro cuestionado. Las revisiones de resultados históricos siguen identificando su ejecución y obsolescencia.

## Borrador y cantidades

El primer alcance permite **un hallazgo seleccionado por reclamo**; no sumar una colección arbitraria de flags. El servidor resuelve la última decisión y la fuente desde la ejecución. Para solicitar corrección monetaria se requiere confirmación explícita vigente, diferencia positiva finita, moneda y proveedor conocidos y control de servicio/precio compatible. `LINE_ARITHMETIC`, consistencias de total, impuestos, unidades sin importe verificable, coincidencias y resultados no verificables nunca se convierten automáticamente en dinero reclamado. Un resultado incierto puede fundamentar una solicitud de aclaración con importe solicitado ausente, mediante el tipo clarification acordado; nunca aparentar un abono cuantificado sin respaldo.

No agrupar proveedores o monedas ni netear diferencias positivas y negativas. Si se amplía a varias partidas, agrupar por organización/operación/proveedor/moneda y excluir hallazgos solapados de la misma partida antes de cualquier suma decimal. No mostrar importe recuperado: importe cuestionado, aceptación del proveedor y corrección efectiva son hechos distintos.

El borrador contiene proveedor, referencia de operación/factura cuando exista, concepto, importe respaldado o dato pendiente, explicación y lista de fuentes. Asunto, cuerpo y destinatario son editables con validación y motivo/historial de cambios según contrato. El destinatario empieza vacío y lo introduce/confirma el usuario; no generar emails a partir del nombre del proveedor. No usar IA externa ni prometer exactitud de redacción universal. Conservar una versión de borrador por cambio y evitar sobrescrituras concurrentes.

## Duplicados y datos cambiantes

Decisión acordada con principal/arquitectura: el MVP admite **un reclamo por documento de factura dentro de una operación**, con un hallazgo seleccionado, sin agregación. La identidad única usa organización/operación/documento facturado, no lineId mutable del parser, runId o índice. Esto limita reclamar simultáneamente otras partidas de esa misma factura; permanecen visibles y revisables. Solo documentos de tipo factura con ID real pueden originar reclamo, nunca un hallazgo de operación sin factura ni una tarifa/registro operativo. Repetir petición o reanalizar los mismos cargos no crea otro reclamo. Mostrar/reutilizar el existente, preservando sus versiones y el seguimiento. Tras reanálisis, permitir una acción explícita de revisar y revincular el borrador existente al nuevo run/hallazgo confirmado, creando una nueva versión. No dejar una factura bloqueada permanentemente por un borrador obsoleto. Una versión cuyo envío fue registrado sigue conservada y nunca se sustituye silenciosamente. Un cambio de importe o evidencia se presenta para revisión explícita; no sustituye automáticamente un borrador enviado.

Crear/exportar una solicitud vigente exige que las fuentes y la confirmación sigan siendo válidas frente a datos actuales y última decisión. Si cambian los datos o la decisión pasa a desestimada/aceptada, mostrar por qué es necesaria una revisión y bloquear la emisión de una solicitud basada en la confirmación anterior. Un expediente histórico permanece consultable y no se reescribe; la política exacta de revisión/vinculación a una nueva ejecución debe quedar explícita en el contrato. No bloquear el simple acceso de lectura a un reclamo histórico.

## Exportación y respaldo

Descargar `.txt` con asunto, destinatario introducido por usuario, cuerpo y referencia del reclamo; descargar `.json` del expediente con versión de borrador, decisiones, ejecución, versión de reglas/parser, fuente, checksum del original, versión de extracción/corrección y evidencias de página/fragmento. Ambos salen de datos autorizados en servidor y conservan la versión exportada. Exportar registra fecha/actor/versión y marca exportado, **no enviado**.

No incluir URLs públicas, URLs firmadas duraderas, secretos ni rutas de almacenamiento. Los PDFs originales siguen privados y se descargan mediante los controles existentes; el expediente no se presenta como adjuntos PDF incluidos si solo contiene metadatos. No inventar nombres o números de factura ausentes. Texto de documentos es dato literal, nunca código/instrucción ejecutable.

## Seguimiento manual

Estados acordados para el contrato: draft (borrador), exported (exportado), sent (envío registrado), in_review (respuesta/en revisión), follow_up (seguimiento pendiente), resolved (resuelto) y rejected (rechazado). Se permite editar antes de registrar envío; cualquier versión posterior conserva el texto que se exportó/envió. Registrar envío exige acción explícita del usuario, fecha de envío válida no futura y destinatario confirmado; la interfaz dice que registra un envío realizado fuera de la aplicación. Ninguna descarga cambia por sí sola a enviado.

Registrar respuesta exige fecha y nota de respuesta; puede permanecer abierto. “Lo estamos revisando” no resuelve el reclamo. Resolver exige fecha, motivo y resultado humano explícito (corregido, aceptado sin corrección, rechazado o retirado, según contrato). Resolver no afirma por sí solo importe recuperado ni corrección contable comprobada. Próximo seguimiento es fecha visible, editable, con indicador vencido; no se envían emails ni alertas externas. No permitir fechas imposibles ni secuencias incompatibles (respuesta anterior a envío, cierre anterior al inicio). Las transiciones se validan en servidor y quedan auditadas.

## Aceptación observable

| Caso | Resultado |
|---|---|
| Demo completo sin decisión | No crear automáticamente reclamo de 62 USD |
| Confirmar pickup con motivo | Decisión ligada al run/hallazgo; borrador de 62 USD con proveedor/operación/evidencia correctos |
| Desestimar/aceptar después | Nueva revisión histórica; emisión anterior requiere revisión, sin borrar borrador ni fuentes |
| Mismo cargo tras reanálisis o doble clic | Un reclamo estable, sin duplicado ni dinero sumado dos veces |
| Error aritmético y diferencia de servicio misma línea | No sumar ambos flags como dos importes cuestionados |
| Proveedor/moneda distintos | No combinar en el mismo reclamo |
| Importe ausente o incertidumbre | No inventar importe; aclaración explícita o explicación del dato necesario |
| Datos revisados/corregidos después del run | Aviso de obsolescencia y revisión exigida, histórico intacto |
| Exportar texto/expediente | Contenido editable guardado y trazable; estado exportado, no enviado |
| Registrar envío | Confirmación manual y fecha/destinatario; no llamada SMTP |
| Respuesta “en revisión” | Respuesta registrada; continúa abierto |
| Resolver | Fecha, resultado y motivo; no afirma recuperación financiera |
| Lector, revocación o IDs ajenos | Lectura según permiso vigente; mutaciones/exportación de negocio rechazadas sin filtrar datos |
| Conflicto o error de red | Borrador y motivo conservados; reintento explícito sin sobrescribir cambios ajenos |

## Salida del MVP y comprobación

La fase 4 completa el recorrido documental hasta un reclamo revisado/exportable y seguimiento básico. Llevarlo al servidor requiere todavía fase 5: HTTPS, servicios privados, secretos, backups externos y restauración comprobada, recuperación de jobs y recorrido desplegado. Datos reales requieren validación con el experto y controles previstos en el plan; una demo sintética desplegada no acredita esa validación.

Comprobar reglas/contratos, integración real de autorización/concurrencia/auditoría/exportación, y navegador independiente con fixtures declarados. Medir casos revisados, duplicados evitados y omisiones/correcciones observadas; no anunciar precisión ni ahorro general a partir de un ejemplo.

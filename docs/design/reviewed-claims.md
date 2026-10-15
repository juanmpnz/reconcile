# Revisión humana y reclamos

Fecha: 2026-10-15. Blueprint previo a implementación por /root/analysis_ux. Roles UX, visual, producto y accesibilidad; aplicar perfiles y límites de AGENTS.md y .agents/WORKFLOW.md. Conservar la interfaz compacta aprobada y operation-usability.md. Este texto define comportamiento, no certifica implementación ni sustituye contratos acordados con producto/dominio/arquitectura.

## Recorrido y jerarquía

En la tabla de resultados existente, añadir una columna o acción discreta Revisar. El resultado del motor conserva sus colores y texto; la revisión humana es un estado independiente con etiqueta neutral: Sin revisar, Confirmado por operador, Desestimado o Diferencia aceptada, según contrato. Nunca convertir un rojo en verde por aceptar una diferencia, ni presentar revisión como aprobación de factura, posteo o pago. Mostrar el resultado primero; revisión/reclamos son secciones compactas, no tarjetas gigantes ni otro dashboard.

Revisar abre diálogo con concepto, proveedor, importe/moneda y motivo del motor, acceso a evidencia, decisión con etiquetas explícitas y motivo obligatorio. Explicar qué significa cada decisión; Desestimar no borra el hallazgo y Aceptar diferencia no modifica el acuerdo original. Guardar mantiene autor, fecha, motivo y versiones utilizadas; errores conservan borrador y conflictos requieren recargar/comparar antes de volver a guardar. Historial legible expandible junto al estado, con motivo íntegro accesible. Viewer consulta pero no ve acciones de escritura.

## Preparar reclamo

La decisión de alcance para este MVP es un hallazgo por reclamo: acción discreta Preparar reclamo en la fila elegible, con confirmación explícita del hallazgo y su proveedor/moneda en el diálogo. No implementar casillas multiselección ni agregación de cargos. Cambiar de ejecución/organización elimina el contexto de preparación anterior. No mezclar proveedores ni sumar importes solapados; no incorporar hallazgos ya reclamados silenciosamente. Si un hallazgo no es elegible, explicar la condición real: revisión pendiente, desestimado/aceptado, datos incompletos, ejecución obsoleta o conflicto existente, según política acordada.

Diálogo de preparación muestra proveedor, operación, factura/conceptos seleccionados, importe cuestionado cuando comprobable y lista de documentos de respaldo. Destinatario es dato introducido/revisado por usuario si se incluye; nunca inferir email ni buscar contactos automáticamente. El texto inicial distingue solicitar aclaración de pedir corrección/abono según certeza y revisión; no inventa servicios realizados, fechas o condiciones. No requiere mostrar JSON ni identificadores internos.

## Borrador y exportación

Detalle de reclamo compacto con proveedor, estado y acciones Guardar, Copiar texto, Exportar cuando realmente implementadas. Asunto y cuerpo editables con etiquetas, motivo/historial para cambios según contrato. Los originales y el snapshot de hallazgos/documentos permanecen intactos; editar redacción no reescribe evidencia. Guardar, copiar y exportar tienen estados independientes, feedback claro y reintento. Copiar/exportar no marca Enviado. Clipboard denegado muestra alternativa seleccionable, sin afirmar copia exitosa.

Exportación/copia incluye referencia, proveedor, moneda/importes, conceptos y explicación, versiones o fecha de análisis/revisión y respaldo legible. Descargar original sigue la autorización existente; referencias son filenames/páginas, nunca URLs temporales persistidas ni UUIDs mostrados al usuario. Si ZIP/adjuntos no existen, no prometerlos: ofrecer exportación textual y enlaces individuales autorizados. Aviso visible si el análisis cambió o es histórico; un borrador previo conserva su evidencia original y no se actualiza silenciosamente. Política de bloqueo para crear/exportar desde stale se acuerda con backend; el cliente debe explicar el mismo límite.

## Seguimiento manual

Lista compacta de reclamos con proveedor, estado, última actividad y próxima acción; detalle con historial desplegable. Actualizar seguimiento exige estado y nota/motivo, fecha de próxima acción opcional o requerida según contrato. Mostrar que el registro es manual. Registrar Enviado solo como declaración explícita del usuario, nunca por exportación; no hay envío automático. Resolver requiere motivo/evidencia descrita por usuario, sin calcular dinero recuperado ni implicar conciliación de pagos. Si hay importe aceptado/corregido, mantenerlo separado del cuestionado y solo si lo soporta el contrato. No añadir métricas de recuperación inventadas.

## Estados y accesibilidad

Reutilizar diálogos accesibles y loaders locales. Una única mutación pendiente por acción, sin envíos dobles; datos válidos conservados en error. Fresh authorization controla visibilidad y capacidades; caches/selecciones se separan por usuario, organización, operación y ejecución. Respuestas tardías no cambian otra operación. Navegación al borrador tiene retorno a resultados y foco útil. Tablas en región horizontal nombrada; 320/390px y 200% zoom sin desborde de página. Texto/ícono además de color, etiquetas explícitas, errores enfocados y estados anunciados sin repetir cada polling.

## Criterios de revisión

Verificar decisiones con motivo/historial sin alterar resultado; viewer; cambio de ejecución y selección; elegibilidad precisa; proveedor/moneda incompatibles; borrador editable y conflicto sin perder campos; copia denegada; exportación fiel a versiones; stale/histórico visibles; seguimiento manual con próxima fecha y resolución sin inventar recuperación. Comprobar teclado/foco y móvil. Pruebas con fixtures de navegador demuestran UI; autorización, idempotencia, dinero y snapshots requieren evidencia de dominio/API independiente.

## Política de producto acordada

Consultar docs/product/reviewed-claims.md para condiciones ejecutables: crear/exportar exige ejecución completada y vigente y última revisión Confirmar. Corrección económica solo para diferencia positiva de servicio admitida, proveedor y moneda conocidos; hallazgos probables/no verificables preparan aclaración con importe cuestionado ausente, no cero. Controles aritméticos, impuestos y coincidencias no generan demandas económicas automáticas. Cada reclamo contiene un hallazgo; la prevención adicional de duplicados por factura se rige por el contrato acordado. Si revisión o fuentes cambian, conservar lectura histórica y bloquear nueva emisión con motivo específico, sin reescribir el reclamo anterior.

## Avisos y respaldo exportado

Fuera de cualquier acordeón cerrado mostrar una línea compacta de seguimiento: cantidad de reclamos con próxima acción vencida y próxima fecha pendiente cuando existen. Calcular vencimiento por fecha calendario en la zona local visible del navegador (por ejemplo Hoy según tu fecha local), nunca interpretar YYYY-MM-DD como instante UTC y compararlo ciegamente con Date.now. Un vencimiento es una tarea interna, no prueba de que el proveedor incumplió. No se añade dashboard global ni recordatorio externo.

Texto de exportación: Exportar respaldo JSON — incluye texto, hallazgo, revisiones y referencias trazables; los PDFs originales se descargan por separado desde los enlaces privados. Copiar texto y exportar son acciones locales independientes y no registran envío. Si el usuario solo puede exportar JSON, no llamarlo paquete de PDFs ni adjuntos completos.

La identidad única de reclamo acordada es organización/operación/documento de factura, con un hallazgo por versión. Cuando un reclamo existente quede obsoleto, ofrecer actualización explícita a la ejecución vigente como una nueva versión; conservar versiones previas y su seguimiento, especialmente las registradas como enviadas. No migrar el borrador silenciosamente ni bloquear para siempre esa factura por existir una versión anterior.

## Précision del límite de versiones enviadas

La política final conserva fuentes inmutables tras registrar envío: un reclamo enviado no permite rebase ni un segundo reclamo para esa factura dentro de este MVP. Puede recibir seguimiento manual aunque las fuentes actuales cambien. La actualización explícita de fuentes solo aplica a borradores no enviados. Mostrar este límite con claridad; no ofrecer una acción que el servidor rechazará. Registrar rechazo utiliza resultado Rechazado coherente, no otro resultado preseleccionado.

# Comparación explicable — aceptación del piloto

Estado: definición de fase 3; no supone implementación ni validación sobre documentos reales. Fuente: requisitos del piloto, plan y expediente sintético existente. Responsable: agente analysis_product_domain, roles product-manager y logistics-domain. La definición y la implementación del motor por este mismo agente son trabajo secuencial, no revisión independiente.

## Recorrido y límites

El analista reúne documentos de una operación de su organización, revisa las partidas y condiciones extraídas y solicita un análisis. El procesamiento asíncrono conserva una instantánea inmutable de datos, revisiones, documentos y versión de reglas. La bandeja y el detalle muestran cada partida, esperado, facturado, diferencia, motivo y evidencia. Una nueva corrección permite otra ejecución sin alterar la anterior.

El resultado no aprueba facturas, servicios, pagos ni reclamos y no modifica el estado contable. No se conecta CargoWise, no se envía correo y no se promete lectura universal. El formato inicial es el expediente sintético etiquetado; formatos no reconocidos exigen revisión explícita y nunca reciben respuestas esperadas precargadas.

## Reglas iniciales

- Asociar únicamente documentos con referencia de operación explícita y coincidente; un documento de otra organización nunca puede participar. El usuario confirma las asociaciones inciertas.
- Extraer partidas y condiciones desde el texto de las páginas. Conservar documento, página y fragmento para todo dato decisivo; una corrección conserva autor, motivo y versión.
- Comparar por proveedor, concepto normalizado, tramo, referencia del servicio, fecha, cantidad y unidad. La similitud textual por sí sola no acredita identidad de servicio.
- Aplicar un único acuerdo aceptado y vigente para la fecha del servicio y el alcance explícito. Una estimación interna no es un acuerdo. Si faltan fechas, alcance, aceptación o hay acuerdos superpuestos, declarar no verificable; no elegir arbitrariamente el más reciente.
- Calcular en decimales. Mantener diferencia por partida aunque el total coincida. Separar moneda, impuestos, cantidad y precio. Sin regla respaldada de conversión, no convertir monedas; sin regla explícita, no aceptar redondeos automáticamente. No existe tolerancia global ni validación por margen positivo.
- El precio coincidente no prueba prestación. Un registro de servicio debe indicar proveedor asignado, proveedor registrado como ejecutor, estado, referencia, fecha y tramo.
- Un cargo excluido por el acuerdo es una discrepancia documental para revisión. Solo describir posible doble facturación si existe además factura de otro proveedor y registro de ejecución del mismo servicio, fecha y tramo. Dos pickups de tramos distintos no son duplicados.
- Distinguir fuerza de evidencia: confirmado documentalmente significa contradicción explícita entre fuentes revisadas; probable significa indicio sin respaldo completo; no verificable significa dato o condición ausente/ambigua. Ninguna de estas etiquetas constituye aprobación financiera humana.

## Aceptación observable

| Caso | Resultado requerido |
|---|---|
| Expediente demo completo | Ocean handling: 150 USD frente a 150 USD únicamente cuando el ámbito esté respaldado y revisado; el PDF inicial de factura no acredita explícitamente su puerto, por lo que esta partida exige completar ese dato; pickup del carrier: 62 USD excluido por acuerdo, con evidencia de ejecución y factura del transportista para el mismo servicio; diferencia cuestionada de 62 USD sin aprobar o pagar nada |
| Solo factura carrier | No verificable: faltan condiciones y evidencia de prestación; nunca deducir cobro indebido de 212 menos 150 |
| Solo estimación interna 150 | No verificable como precio acordado |
| Acuerdo vencido o fecha de servicio ausente | No verificable, con dato faltante visible |
| Dos acuerdos aplicables superpuestos | No verificable por ambigüedad, sin prioridad inventada |
| Factura y acuerdo en monedas diferentes | No verificable para comparación monetaria; sin conversión implícita |
| Dos pickups en tramos distintos | No señalar duplicidad por nombre o importe |
| Dos líneas con +10 y -10 | Mostrar ambas diferencias aunque la diferencia total sea cero |
| Cantidad/unidad distinta | Mostrar la discrepancia; no tratar un precio unitario coincidente como total correcto |
| Impuesto ausente, incoherente o diferente | Separar incidencia fiscal/documental; no sumarla silenciosamente al precio |
| Repetir entrega del job | Una sola finalización por ejecución, sin duplicar hallazgos |
| Corrección posterior | Nueva instantánea; la ejecución anterior sigue siendo reproducible |
| Usuario lector o miembro revocado | Consulta según pertenencia vigente; no permite crear/modificar ejecuciones |
| ID de documento/ejecución de otra organización | Rechazo sin filtrar datos ni evidencia |

## Cercanía al MVP

Esta fase completa el núcleo de investigación y comparación. Para el recorrido MVP todavía hacen falta decisión humana y borrador/exportación de reclamo (fase 4), despliegue con HTTPS, almacenamiento privado, backups y restauración comprobada (fase 5). Un despliegue de demostración con datos sintéticos no equivale a habilitar documentos confidenciales reales; estos requieren validación con el experto y los controles del plan.

## Evaluación

La evaluación sintética debe verificar positivos y negativos por regla, datos extraídos de PDFs reales, aislamiento, fallos/reintentos y reproducción de instantáneas. Registrar cuántos casos se ejecutaron, falsos positivos, omisiones y no verificables; no inferir porcentajes generales de precisión de cuatro documentos demo.

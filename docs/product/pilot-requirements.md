# Control de facturas logísticas y gestión de discrepancias

Documento de requisitos de producto para preparar un piloto Kershell.

Fecha: 14 de octubre de 2026. Versión: 0.1.

Fuente: entrevista con un profesional de operaciones de logística internacional. Los hechos descritos son testimonios del entrevistado, todavía no verificados con documentos ni accesos a sistemas. Este documento registra requisitos y propuestas; no supone que las funcionalidades estén implementadas. Nombre comercial y stack pendientes.

## 1. Objetivo

Centralizar tarifas, cotizaciones, facturas y contexto operativo para automatizar su cotejo, explicar discrepancias y preparar reclamos y seguimientos. El operador debe revisar casos ya investigados, en lugar de reconstruir cada diferencia entre sistemas.

La rentabilidad global de una operación no demuestra que un cargo sea correcto. El producto debe identificar pérdidas evitables aunque la operación mantenga margen positivo.

## 2. Usuario y problema confirmados en la entrevista

Usuario principal: profesional de operaciones que controla facturas de proveedores asignadas a sus expedientes. Participan también administración y los responsables de tarifas; sus responsabilidades exactas están pendientes de definir.

Los proveedores incluyen navieras/carriers, transportistas y despachantes de aduana. Las navieras son la prioridad declarada porque facturan muchos conceptos, incluidos cargos locales, documentación y manipulación, y aparecen conceptos no contemplados o diferencias de importe.

Hay mucho volumen, especialmente en cierres de mes. El control, la investigación de diferencias, los correos de disputa y los seguimientos crean un cuello de botella. A veces se aprueba una factura porque el expediente conserva ganancia, sin completar el cotejo, y se absorben cargos indebidos.

Problemas mencionados: costes desactualizados, estimaciones comerciales que no coinciden, códigos de proveedor mal registrados, redondeos, diferencias de moneda y servicios cobrados por quien no los realizó. Frecuencia y magnitud de cada causa pendientes de medir.

## 3. Circuito actual

1. Las facturas llegan a un correo centralizado.
2. Administración las carga en el sistema denominado «Bravo Tran» por el entrevistado; confirmar nombre y producto exactos.
3. El operador consulta sus facturas asignadas y la referencia de operación.
4. Abre esa operación en CargoWise y revisa los costes por proveedor y concepto. Allí también se registra la venta.
5. Según el relato, cuando el cotejo permite la aprobación, la factura se postea y entra en el circuito de pago. Una discrepancia impide ese paso y requiere revisión manual.
6. El operador investiga, reclama por email, recibe respuestas y vuelve a pedir seguimiento.

No se han verificado las capacidades nativas, configuración, API ni mecanismos de exportación de CargoWise o Bravo Tran. La relación exacta entre aprobar, postear y pagar debe documentarse antes de cualquier integración de escritura.

## 4. Caso de prueba acordado: recogida de 62 USD

| Elemento | Información aportada |
|---|---|
| Operación | Una misma referencia logística; valor real pendiente |
| Transportista | Realizó la recogida/pickup; coste y factura ya posteados en CargoWise |
| Carrier | Coste estimado de 150 USD |
| Factura del carrier | Total de 212 USD |
| Diferencia | 62 USD atribuidos a una recogida que realizó otro proveedor |
| Resultado actual | La factura del carrier quedó sin postear; el operador investigó y reclamó manualmente |

Resultado esperado del piloto: localizar el concepto adicional, relacionarlo con la misma recogida ya asignada al transportista, mostrar la evidencia y preparar un reclamo de corrección o abono por 62 USD.

La resta 212 − 150 no basta para probar un cobro indebido. Deben verificarse el desglose de la factura, el alcance del servicio y los registros operativos. Dos cargos llamados «pickup» pueden corresponder a tramos distintos; no se marcarán como duplicados confirmados solo por similitud de nombre.

## 5. Requisitos funcionales

### 5.1. Entrada y centralización

- Subir documentos de tarifas/costes de navieras en PDF, sin transcribir cada concepto.
- Subir facturas y asociarlas a su proveedor y referencia de operación.
- Incorporar cotizaciones específicas de una operación y excepciones aprobadas.
- Conservar originales y versiones como respaldo de cada comparación.
- Incorporar el cuerpo del email y adjuntos como fuentes cuando contengan tarifas, condiciones o facturas. La captura inicial puede ser manual; conectar el buzón requiere autorización y viabilidad técnica.
- Importar contexto de CargoWise para comparar servicios y cargos entre proveedores. Para el piloto se aceptan exportaciones o registros anonimizados; el formato disponible está pendiente.
- Detectar documentos repetidos y permitir corregir una asociación incorrecta.

### 5.2. Extracción y revisión mínima

Extraer proveedor, número de documento, referencia, fechas, conceptos, cantidades, unidad de cobro, precios, moneda, impuestos y totales cuando existan. De las tarifas extraer también vigencia y condiciones de aplicación: ruta, puerto, tipo de contenedor, servicio u otras presentes en el documento.

La extracción debe conservar la página o fragmento de origen. Los datos ausentes o ambiguos se señalan; no se inventan. El objetivo es revisar únicamente los puntos inciertos, no obligar a recargar todo a mano. Una lectura aparentemente correcta no garantiza que la tarifa aplique a una operación.

### 5.3. Tarifas y vigencias

- Guardar cada versión de tarifa con proveedor, origen, fecha y condiciones.
- Avisar antes de su vencimiento; antelación y canal configurables, pendientes de acordar.
- Mostrar tarifas vencidas, faltantes o superpuestas.
- Aplicar la tarifa correspondiente al servicio y fecha pertinente, no automáticamente la última disponible. La fecha de referencia debe derivarse de las condiciones acordadas; no asumir siempre la fecha de factura.
- Distinguir coste estimado internamente de precio realmente acordado con el proveedor.
- Resolver la prioridad entre contrato, tarifa general, cotización particular y excepción aprobada según reglas del negocio aún pendientes.

### 5.4. Cotejo por operación y concepto

- Identificar proveedor y expediente; proponer coincidencias inciertas para revisión.
- Comparar cantidades, unidad de cobro, importe y condiciones de cada partida.
- Mantener equivalencias de conceptos y códigos validadas por usuarios; evitar unir servicios distintos por una similitud textual.
- Detectar conceptos no contemplados, diferencias de importe, posibles facturas duplicadas y posibles cobros de un mismo servicio entre proveedores.
- Comparar cada servicio facturado con su asignación y evidencia operativa disponible.
- Descomponer la diferencia total por partidas; dos errores compensados no deben pasar como coincidencia porque el total cuadre.
- Separar moneda, impuestos y redondeos de diferencias en el precio del servicio. Verificar fuente, fecha y regla de cambio antes de considerar justificada una conversión.

### 5.5. Bandeja de revisión

Estados propuestos: pendiente de datos, en análisis, sin discrepancias detectadas, discrepancia para revisar y revisión completada. El resultado del análisis es independiente del estado contable de la factura.

Cada caso muestra referencia, proveedor, factura, cargos afectados, importe esperado y facturado, diferencia, motivo, respaldo y dato faltante si corresponde. Debe permitir confirmar el hallazgo, corregirlo o aceptar una diferencia con motivo registrado.

Una factura no verificable no se presenta como correcta. Una coincidencia de precio no demuestra que el servicio se prestó. Un coste estimado diferente tampoco demuestra por sí mismo un cobro indebido.

### 5.6. Reclamos y seguimiento

- Preparar un borrador de correo con proveedor, factura, operación, concepto, importe cuestionado, explicación y justificantes pertinentes.
- Solicitar aclaración cuando haya incertidumbre; solicitar corrección o abono cuando exista respaldo suficiente.
- Permitir al operador revisar y editar el reclamo antes de enviarlo. Confirmar destinatario; no enviar automáticamente durante el piloto.
- Mantener estados propuestos: borrador, enviado, en revisión por proveedor, seguimiento pendiente, corrección recibida, resuelto o rechazado.
- Registrar respuestas y fechas; preparar seguimientos según plazo acordado. Registrar envío real solo cuando haya constancia.
- Distinguir importe cuestionado, aceptado por el proveedor y efectivamente corregido/recuperado. Una respuesta «lo estamos revisando» no cierra el caso.

## 6. Reglas de negocio esenciales

| Regla | Consecuencia |
|---|---|
| Margen positivo no valida un coste | Nunca justificar automáticamente un cargo por la ganancia global |
| El precio y la prestación son controles diferentes | Comprobar tanto tarifa aplicable como proveedor/servicio |
| No hay tolerancia universal por importe pequeño | Definir tolerancias por causa, moneda y regla; cargo nuevo sigue siendo revisable |
| Los importes requieren precisión decimal | Evitar errores por aritmética de coma flotante; política de redondeo explícita |
| La evidencia prevalece sobre una inferencia | Mostrar origen y separar confirmado, probable y no verificable |
| Las tarifas cambian | Mantener historial y revisar vigencia y ámbito |
| Las decisiones humanas quedan trazadas | Registrar autor, fecha, motivo y documentos usados |
| Un hallazgo no equivale a una aprobación de pago | No modificar estados contables por el mero resultado del análisis |

## 7. Datos mínimos del producto

Entidades conceptuales para orientar el futuro diseño, sin imponer esquema técnico: empresa, usuario, proveedor y alias, operación y referencias, servicio y asignación, documento original, tarifa y versión, condición de aplicación, factura y partidas, cotización, evidencia, ejecución de análisis, discrepancia, decisión y reclamo con comunicaciones y plazos.

Cada resultado debe poder reconstruirse con la versión de documentos, reglas y datos que se usó. Reprocesar una factura con nueva evidencia debe conservar el análisis anterior y evitar duplicar reclamos.

## 8. Alcance del piloto

Primera fase: una empresa, una naviera/carrier y operaciones seleccionadas. Entrada manual de documentos y contexto exportado; extracción, comparación, explicación y borrador de reclamo. El caso de 62 USD es la primera prueba acordada.

Después, ampliar a cinco casos históricos ya revisados, incluyendo al menos una factura correcta y ejemplos distintos de discrepancias si están disponibles. Es una prueba de viabilidad, no una demostración estadística de precisión.

Fuera del piloto inicial: posteo automático, ejecución de pagos, envío desatendido de reclamos, sustitución de CargoWise/Bravo Tran, integración completa del correo y de ambos sistemas, cobertura de todos los proveedores y tarifas. Estas funciones se evaluarán después según resultados y permisos.

## 9. Material necesario y ejecución

Los documentos no estaban disponibles durante la entrevista. Se acordó prepararlos posteriormente; no se ha recibido ningún fichero ni acceso.

Para el caso inicial se requiere: factura del carrier con desglose, registro de su coste estimado, asignación y factura de la recogida del transportista, tarifa/cotización aplicable si existe y reclamo/respuesta históricos si están disponibles.

Anonimizar de forma coherente: conservar referencias comunes, conceptos, importes, moneda, fechas y condiciones necesarios para el cruce. Evitar compartir datos de clientes ajenos al análisis.

Procedimiento: fijar con el experto el resultado esperado, procesar los documentos, comparar hallazgos y borrador con su revisión, registrar errores y medir tiempo. Repetir con los demás casos y decidir si ampliar o corregir el enfoque.

## 10. Criterios y métricas

- El caso inicial identifica la discrepancia de 62 USD y la vincula al concepto y evidencia correctos, o explica exactamente qué dato falta.
- El reclamo contiene los importes y referencias correctos, sin inventar condiciones ni prestación de servicios.
- Una factura correcta no se marca indebidamente como reclamable; datos insuficientes generan solicitud de revisión.
- Todas las conclusiones permiten consultar su respaldo.
- No se modifican facturas, pagos ni sistemas de origen y no se envían correos durante la prueba.

Medir tiempo manual frente a tiempo con herramienta, discrepancias reales detectadas y omitidas, falsas alertas, correcciones de extracción, datos faltantes y calidad del borrador. Registrar número de casos y revisión del experto; no anunciar porcentajes de precisión a partir del único ejemplo. Los umbrales para ampliar se acordarán tras conocer la línea base. No se promete automatización total.

## 11. Requisitos transversales y diseño

Acceso por rol, protección de documentos comerciales, aislamiento entre empresas si se amplía, copia de seguridad, control de acceso a adjuntos y registro de cambios. Acordar conservación, ubicación de datos y uso de proveedores externos antes de procesar documentos reales. Contenido de PDFs y emails se trata como datos, nunca como instrucciones para ejecutar acciones.

Diseño propuesto alineado con las microapps Kershell: sobrio, elegante y profesional, con una bandeja clara y detalle de comparación por concepto, acceso a evidencia y una acción principal para revisar el reclamo. Evitar mostrar información dispersa que vuelva a exigir investigación manual. Kit de diseño definitivo pendiente; no se ha creado archivo Figma para este producto.

## 12. Decisiones abiertas antes de elegir el stack

1. Nombre exacto de Bravo Tran y formatos de exportación disponibles en ambos sistemas.
2. Posibilidad autorizada de consultar CargoWise, correo y adjuntos; APIs y permisos no verificados.
3. Calidad de PDFs, escaneos, idiomas y variedad de formatos; necesidad real de OCR.
4. Volumen mensual, picos, tiempo de revisión y número de operadores.
5. Datos que prueban quién hizo un servicio y con qué granularidad se registran.
6. Responsable de tarifas, prioridades documentales, fecha de aplicación y reglas de moneda/redondeo.
7. Casos de tarifas inclusivas, suplementos, abonos, impuestos y facturas con varias operaciones.
8. Plazos y destinatarios de reclamo; criterios de cierre y aceptación de diferencias.
9. Infraestructura, presupuesto, requisitos de alojamiento y uso permitido de IA externa.
10. Capacidades existentes de los sistemas y alternativas comerciales: pendiente investigar antes de afirmar diferenciación o ausencia de competencia.

El stack se elegirá después de comprobar estos datos. Deberá cubrir ingestión documental, extracción, almacenamiento de originales y versiones, reglas auditables, trabajos en segundo plano y una interfaz de revisión. La IA puede ayudar a leer y redactar; cálculos y reglas financieras deben ser verificables.

## 13. Siguiente paso acordado

Preparar el expediente anonimizado del pickup de 62 USD y revisar con el experto los documentos y resultado esperado. Con ese material se define el contrato de datos del piloto, se elige el stack y se redacta el plan de implementación.

# Revisión rápida de operaciones

Fecha: 2026-10-15. Blueprint previo a implementación por /root/analysis_ux, roles producto, dominio logístico, UX, visual y accesibilidad. Complementa analysis-workspace.md. Alcance: hacer el análisis existente más breve, claro y corregible; no ampliar reglas financieras ni añadir decisiones contables/reclamos.

## Prioridad de lectura

Encabezado compacto con referencia, nombre y acciones Editar operación / Analizar. Mostrar primero el último resultado o estado en curso; debajo, documentos, datos e historial en acordeones nativos con resumen visible. Una persona debe poder contestar qué necesita revisar sin atravesar todos los datos extraídos. Mantener Arial 14px, títulos 22px, fondo blanco y tablas al ancho disponible.

El resumen cuenta partidas por resultado: diferencias respaldadas, posibles diferencias, no verificables y coincidencias de precio. No sumar importes de hallazgos: pueden solaparse o tener monedas distintas. Las cuentas describen la ejecución seleccionada, no documentos actuales ni dinero recuperado. Si el resultado es histórico/desactualizado, decirlo junto al resumen. Pendiente, fallido y sin análisis tienen mensajes propios, sin ceros que aparenten resultado.

## Señales de resultado

Usar rojo para diferencia respaldada, verde para coincidencia dentro del control efectivamente realizado, ámbar para posible diferencia y no verificable. Cada señal lleva icono decorativo más texto explícito; color nunca es la única distinción. Verde dice Sin diferencia de precio detectada, no Factura correcta ni Servicio validado. Rojo no significa fraude, pago bloqueado ni reclamo enviado. Ámbar nombra el requisito faltante. Paleta accesible sugerida: rojo #b42318 sobre #fef3f2, verde #067647 sobre #ecfdf3 y ámbar #92400e sobre #fffbeb; verificar contraste real con estilos finales. Iconos no duplican el nombre accesible.

## Evidencia breve sin pérdida

En cada hallazgo mantener concepto/proveedor, esperado, facturado, diferencia, moneda y motivo. Agrupar citas por documento; mostrar nombre y página, texto literal y enlace al original autorizado. Deduplicar únicamente citas exactamente iguales por documento, página y fragmento. No fusionar páginas, versiones o fragmentos parecidos. Mostrar primero evidencias decisivas cuando la regla/contrato las identifica; no inventar importancia por posición o longitud. Si no hay clasificación fiable, conservar orden estable de las fuentes y llamarlas Evidencias del hallazgo. Dejar el resto en Ver todas las evidencias (N), con recuento real y acceso a cada cita. Nunca truncar sin posibilidad de leer el fragmento completo. El resultado no debe repetir el mismo bloque enorme varias veces por una cita duplicada.

## Paneles de soporte

Documentos (N vinculados) resume estados reales y limitaciones; abre selector existente para vincular o quitar asociaciones. Quitar de operación no borra PDF, extracción ni análisis históricos; decirlo antes de guardar. No ofrecer Borrar documento. Datos para comparar resume candidatos/revisiones y limitaciones, con revisión por documento y sus originales. Historial resume número real cuando conocido, o Últimos 5 sin fingir totalidad; conserva paginación completa y selección de una ejecución anterior. No ocultar una alerta importante únicamente dentro de un acordeón cerrado: indicador/resumen y requisito faltante deben quedar fuera.

## Correcciones y edición

Editar operación permite modificar nombre y referencia mediante API real, validación, estado guardando y error conservando borrador. Referencia es identidad de comparación: cambiarla puede invalidar asociaciones y análisis previos; mostrar aviso claro de datos modificados/reanalizar tras guardar. No reescribir referencias extraídas para hacerlas coincidir silenciosamente.

Correcciones de datos conservan original, valor revisado, motivo e historial existentes. No borrar citas ni sustituir el PDF. Formularios muestran únicamente campos pertinentes al tipo; originales/datos inciertos siguen consultables por lector. No añadir confirmar/desestimar hallazgo, aprobación de factura ni envío de reclamo en este cambio.

## Preflight y faltantes

Antes de ejecutar, comparar la referencia esperada de la operación con la referencia encontrada en cada documento cuando ambas están presentes. Mostrar nombre del documento y Esperada: X / Encontrada: Y, acción Revisar datos o Gestionar documentos. No completar referencia ausente ni tomar similitud textual como equivalencia. Si el backend define incompatibilidad como bloqueo, deshabilitar ejecución con explicación visible y aplicar la misma regla en servidor; una advertencia exclusivamente cliente nunca protege una regla de negocio. Si falta referencia, indicar Sin referencia identificada, no Incompatible.

Mensajes concretos proceden de hechos/contratos reales: falta tarifa/acuerdo, extracción pendiente/no compatible, moneda ausente/incompatible, condición o alcance no verificable. No decir que falta un registro cuando el motivo real es otro ni que una factura es incorrecta por carecer de soporte. Si el motor solo entrega explicación agregada, usarla fielmente y no inventar una lista de requisitos. Un pickup en otro tramo no es duplicado por compartir nombre; margen positivo y cargo pequeño no justifican validez.

## Aceptación observable

- Último resultado aparece antes de paneles extensos, con conteos fieles y sin suma de importes.
- Rojo/verde/ámbar tienen icono y texto; contraste verificable; verde restringido al control comparado.
- Evidencia agrupada/deduplicada conserva todas las citas únicas, página y acceso al original; expandir permite leerlas completas.
- Documentos/datos/historial operables por teclado, resumen explícito y alertas importantes visibles al cerrar.
- Editar nombre/referencia persiste, falla sin perder borrador y vuelve obsoleto el resultado previo según contrato.
- Desvincular no borra original ni historial; selector conserva asociación entre páginas.
- Referencia incompatible informa esperado/encontrado; dato ausente tiene mensaje diferente; servidor verifica el bloqueo acordado.
- Corrección conserva original, motivo e historial. Lector no ve mutaciones.
- Verificar 320/390px, 200% zoom, foco/retorno en diálogos, carga local, error/reintento y cambios de permisos. Pruebas de navegador con fixtures prueban UI; API/reglas requieren evidencia separada.

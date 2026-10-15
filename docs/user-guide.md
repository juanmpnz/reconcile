# Reconcile — guía de la versión actual

Alcance de esta entrega: cuentas, organizaciones, miembros, invitaciones, documentos PDF, comparación por operación, revisión humana y reclamos con respaldo y seguimiento manual. Consultar docs/status.md para la evidencia de verificación.

## Entrar

Abrí http://localhost:5173 y creá una cuenta con nombre, correo y contraseña de al menos 12 caracteres. En desarrollo, los correos llegan a Mailpit (http://localhost:8025), no a una casilla real. Abrí el enlace del correo y después iniciá sesión. La verificación no inicia sesión automáticamente.

Si no podés entrar, usá las opciones de reenviar verificación o recuperar contraseña. Pedir un correo muestra una respuesta genérica para no revelar si una dirección tiene cuenta.

## Organizaciones

La tabla muestra únicamente los espacios a los que pertenece tu cuenta. Podés buscarlos por nombre o identificador y abrir el que corresponda.

Crear organización abre un formulario con nombre e identificador. El identificador usa minúsculas, números y guiones (por ejemplo `mi-empresa`). Al crearla serás su propietario. Un espacio personal también se modela como organización.

## Miembros e invitaciones

Dentro de una organización, Miembros muestra las cuentas incorporadas y sus roles. Las páginas se consultan al servidor. No se incluyen controles de cambio de rol o eliminación de miembros en esta interfaz.

Invitaciones muestra los correos invitados, permisos, estados y vencimientos que devuelve el servidor. Una invitación no equivale a una membresía: primero debe aceptarla una cuenta verificada con el mismo correo. El listado de invitaciones usa la respuesta nativa disponible, sin inventar totales o historial global.

Propietarios y administradores pueden invitar como Analista o Lector. También pueden cancelar una invitación pendiente y vigente. Los controles requieren permiso actual y el servidor comprueba cada acción. Los miembros de la organización pueden consultar ambos listados según la política existente.

Para probar una invitación en local: enviála a otra dirección ficticia; abrí Mailpit; copiá/abrí el enlace en otro perfil de navegador o ventana privada; registrate con esa dirección, verificála e iniciá sesión; aceptá la invitación. Usar otro perfil evita mezclar las sesiones del remitente y del invitado. No compartas enlaces con tokens.

## Navegación y estados

Organizaciones vuelve al listado. Las secciones Documentos, Miembros e Invitaciones conservan su contexto en la URL; atrás/adelante del navegador permite volver a las vistas anteriores.

Los diálogos tienen Cancelar y pueden cerrarse con Escape cuando no están enviando. Si una solicitud falla, el formulario conserva lo escrito. Una cuenta sin permisos ve una explicación; un listado sin datos muestra un estado vacío, distinto de un error de servicio.

Cerrar sesión elimina la sesión y los datos protegidos de la interfaz. Si otra persona revoca tu acceso, la siguiente comprobación del servidor debe impedir continuar en ese espacio.

## Documentos y primera prueba demo

Dentro de tu organización, abrí Documentos. Propietario, administrador y analista pueden subir PDFs de hasta 10 MiB; el lector consulta y descarga. Elegí el archivo y su clase (factura, tarifa, cotización, registro operativo u otro). El documento pasa por En espera y Extrayendo texto; el worker debe estar ejecutándose. Podés salir y volver mientras se procesa.

Para probar con datos ficticios, los cuatro PDFs están en `fixtures/logistics/source-documents/` del repositorio. Subí `carrier-invoice.pdf` y `transport-invoice.pdf` como facturas, `carrier-agreement.pdf` como tarifa y `pickup-record.pdf` como registro operativo. Todos dicen DEMO y no tienen validez comercial. El archivo repetido dentro de la organización devuelve el documento existente.

Abrí una fila para consultar los datos y su evidencia de página, el texto conservado por página y Descargar original. El PDF original se descarga después de comprobar tus permisos; no es una URL pública.

Esta primera versión busca seis campos etiquetados: proveedor, número, referencia, fecha, moneda y total. Lee texto real del archivo, pero no reconoce universalmente formatos de navieras ni extrae todavía todas las partidas. Un campo ausente o ambiguo queda para revisar; el registro operativo demo no tiene total deliberadamente. Un documento escaneado sin texto requiere OCR aún no disponible.

Para corregir un dato, abrí Corregir, escribí el valor y el motivo. Si no hay respaldo, registrá Sin dato verificable. El historial conserva el original y la corrección. Esto no aprueba una factura ni un pago. Los fallos/bloqueos muestran el motivo; con permisos de escritura podés solicitar otra extracción cuando el estado lo permita.

### Corregir nombre o tipo sin volver a subir

En la tabla Documentos, **Editar datos** permite corregir el nombre visible y el tipo con un motivo. Para `carrier-agreement.pdf`, elegí **Tarifa**. El PDF original no se reemplaza; el detalle conserva el historial con cambios, autor y fecha. Si otra persona lo modifica mientras editás, revisá los datos vigentes antes de guardar nuevamente.

Los cambios dejan desactualizados los análisis que usaron ese documento: volvé a la operación y ejecutá **Volver a analizar**. Cambiar el tipo puede invalidar datos de comparación revisados bajo la clasificación anterior; revisalos antes de analizar. Los resultados históricos se conservan.

La tabla distingue la **referencia extraída del PDF** de las **operaciones vinculadas**. Una referencia coincidente no vincula el documento automáticamente. La búsqueda y la ordenación se aplican a toda la organización y conservan la paginación.

## Comparar una operación

1. Subí los cuatro PDFs demo como se explica arriba, o usá los que ya cargaste. No hace falta volver a subirlos. Esperá que tengan texto extraído.
2. Abrí **Operaciones → Crear operación**. Referencia: `OP-DEMO-062`; nombre, por ejemplo, `Prueba de recogida`. La referencia debe coincidir con la de las fuentes; no es una referencia inventada de CargoWise.
3. Abrí el bloque **Documentos**, pulsá **Gestionar documentos** y seleccioná las dos facturas, el acuerdo y el registro operativo. Podés elegir hasta 20 documentos de tu organización. Desmarcar un documento quita su vínculo con esta operación; no borra el original ni los análisis históricos. Si un documento seguía procesándose, usá **Recargar datos** cuando termine.
4. En **Datos para comparar**, abrí **Ver datos y evidencia**. Se obtienen las partidas, exclusiones, vigencia y prestación desde el texto real del PDF. Los campos ausentes siguen ausentes. Revisar datos permite corregirlos con un motivo; conserva documento original, autor y revisión. El tipo de fuente no se cambia desde esta revisión.
5. Pulsá **Analizar operación**. El worker pasa de En espera a Analizando y al resultado. Podés salir y volver; no necesita mantener el diálogo abierto.
6. Inspeccioná cada hallazgo y su evidencia: documento, página y fragmento, importe esperado, facturado, diferencia y moneda. Una fila sin diferencia de precio no aprueba una factura ni acredita prestación.

### Leer el resultado rápidamente

El resultado aparece antes de los bloques extensos. Rojo indica una diferencia respaldada por evidencia; verde, que no se detectó diferencia de precio dentro del alcance comprobado; ámbar, una posible diferencia o datos no verificables. Cada estado incluye texto e icono. Los contadores describen hallazgos del análisis seleccionado, no importes recuperables. Un error de suma y un cargo duplicado pueden solaparse: no se suman automáticamente.

La evidencia se agrupa por documento, con página y fragmento. Las citas idénticas de la misma extracción y revisión se muestran una sola vez; podés expandir el resto. Documentos, datos para comparar e historial son plegables. Los avisos de referencias incompatibles y resultados con datos previos permanecen visibles.

### Corregir la operación sin empezar de nuevo

Usá **Editar operación** para cambiar nombre y referencia. Por ejemplo, si pusiste `test` en la referencia y los PDF dicen `OP-DEMO-062`, corregí la operación; no cambies los documentos para forzar su coincidencia. Los avisos muestran la referencia esperada y la encontrada. Una referencia ausente no demuestra pertenencia a la operación.

Después de guardar cambios en la operación, sus documentos o los datos revisados, el resultado anterior queda conservado y puede aparecer como desactualizado. Pulsá **Volver a analizar** para generar uno nuevo. Mientras hay un análisis en espera o en curso, esperá a que termine para editar la operación o sus vínculos. Si otra persona cambió los datos mientras editabas, la aplicación rechaza la versión antigua y conserva tu borrador para revisarlo; no sobrescribe sus cambios silenciosamente.

**Revisar datos** conserva la extracción original, el motivo y el historial. El enlace al documento permite contrastar el PDF y la extracción originales. Editar o revisar no aprueba facturas ni valida por sí mismo la prestación.

En el expediente original, el pickup del carrier muestra 62 USD excluidos por el acuerdo y evidencia de la misma recogida por el transportista. La factura del transportista por sí sola no tiene un acuerdo tarifario propio, así que no se presenta como globalmente validada. La partida de servicio base marítimo de 150 USD no declara su ámbito en la factura: queda no verificable hasta revisar ese dato con respaldo. No se deduce su puerto a partir de la ruta de la recogida.

Si antes probaste cambiar el total a 211.00, el análisis también debe señalar que ya no coincide con la suma de partidas. Para volver al escenario original, registrá otra corrección a 212.00 con su motivo; no borres el historial.

Probá después cambiar un dato revisado o retirar una fuente y reanalizar. La ejecución anterior queda conservada y se avisa que los datos cambiaron. El historial reciente muestra las cinco últimas ejecuciones; **Ver historial completo** consulta páginas del historial y carga el detalle elegido. La revisión de datos muestra las 100 últimas revisiones, con motivo y fecha. Los datos manuales se distinguen de los candidatos extraídos; revisar no certifica que el servicio haya ocurrido.

Si falta acuerdo vigente, hay condiciones contradictorias, moneda distinta o servicios de tramos diferentes, la aplicación debe explicar la incertidumbre y no inventar conversiones o duplicidades. Formatos no reconocidos o demasiado grandes para el alcance de comparación se muestran como fuentes no utilizables, conservando el original.

## Revisar hallazgos y preparar un reclamo

1. Abrí una operación y elegí un análisis completado y vigente. Consultá el motivo y sus fuentes antes de decidir.
2. Registrá una revisión: confirmar el hallazgo, desestimarlo o aceptar la diferencia. Escribí un motivo. Se conserva quién lo decidió y cuándo; una revisión posterior añade historial. El color del motor y la decisión humana son estados diferentes.
3. Desde un hallazgo confirmado, prepará el reclamo. Para el pickup demo, el importe cuestionado es **62 USD** si las fuentes siguen vigentes. El servidor toma los datos del análisis. Los errores de suma, impuestos o condiciones no verificables no se convierten automáticamente en dinero reclamado; una solicitud de aclaración lleva importe sin cuantificar.
4. Revisá y guardá destinatario, asunto y cuerpo. El destinatario empieza vacío. Cada cambio conserva su versión y motivo. El MVP mantiene un reclamo por factura dentro de la operación, iniciado desde un hallazgo; al reanalizar, reutiliza ese reclamo en lugar de duplicarlo.
5. Copiá o exportá el texto revisado y descargá el expediente de respaldo. El texto sirve para preparar el correo fuera de la aplicación. El expediente JSON conserva la trazabilidad de las fuentes y revisiones; los PDF originales se descargan por separado mediante su acceso privado. Exportar no registra un envío.
6. Cuando hayas enviado el correo por tu cuenta, registrá manualmente el envío, su fecha y el destinatario confirmado. La aplicación conserva el texto y la evidencia de esa versión.
7. Registrá las respuestas y la próxima fecha de seguimiento. Una respuesta «lo estamos revisando» deja el caso abierto. Los seguimientos vencidos se señalan dentro de la aplicación.
8. Cerrá el reclamo con fecha, resultado y motivo. El cierre registra tu decisión; no calcula dinero recuperado ni modifica facturas o pagos.

Si cambian los documentos, los datos del análisis o la decisión de revisión, el reclamo anterior conserva su contenido y se muestra desactualizado. Para emitir otro texto vigente, revisá el nuevo análisis y vinculalo explícitamente al mismo borrador mediante una nueva versión. Un reclamo con envío ya registrado conserva su seguimiento y no se cambia silenciosamente a otra fuente.

Propietarios, administradores y analistas pueden revisar y preparar reclamos. El lector consulta decisiones, borradores e historial; no crea nuevas exportaciones de negocio ni registra cambios. Un conflicto conserva tu borrador y requiere revisar la versión actual antes de reintentar.

## Indicadores de espera

La sesión inicial y las primeras consultas muestran un indicador y texto. Las actualizaciones conservan filas autorizadas visibles; cada botón indica su propia acción pendiente y evita envíos repetidos. Si tenés activada la preferencia de reducir movimiento, los indicadores permanecen estáticos. No se muestran porcentajes de avance estimados.

## Qué falta

El siguiente paso es preparar el servidor con HTTPS, secretos, almacenamiento privado, backups y restauración comprobada (fase 5). No hay OCR, reconocimiento universal de facturas, importación JSON operativa ni integración real con CargoWise/correo. La prueba con documentos confidenciales reales requiere validación adicional del experto y los controles acordados.

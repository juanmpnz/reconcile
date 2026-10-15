# Reconcile — guía de la versión actual

Alcance de esta entrega: cuentas, organizaciones, miembros, invitaciones y documentos PDF con extracción de texto y revisión. La comparación de facturas y los reclamos pertenecen a los próximos pasos; consultar docs/status.md para la evidencia de verificación.

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

## Indicadores de espera

La sesión inicial y las primeras consultas muestran un indicador y texto. Las actualizaciones conservan filas autorizadas visibles; cada botón indica su propia acción pendiente y evita envíos repetidos. Si tenés activada la preferencia de reducir movimiento, los indicadores permanecen estáticos. No se muestran porcentajes de avance estimados.

## Qué falta

Faltan el cotejo por partidas, aplicación de tarifas/condiciones, hallazgos y reclamos. La carga documental prepara evidencia; todavía no calcula si los 62 USD deben reclamarse. No hay OCR, importación JSON operativa ni integración real con CargoWise/correo. El contrato demo JSON documentado sirve para preparar el siguiente desarrollo, no es una exportación oficial de un ERP.

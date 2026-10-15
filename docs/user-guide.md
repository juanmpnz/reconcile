# Reconcile — guía de la versión actual

Alcance: cuentas, organizaciones, miembros e invitaciones. Esta guía acompaña la renovación de la interfaz de identidad. Las facturas, la extracción y los reclamos todavía no están disponibles.

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

Organizaciones vuelve al listado. Las secciones Miembros e Invitaciones conservan su contexto en la URL; atrás/adelante del navegador permite volver a las vistas anteriores.

Los diálogos tienen Cancelar y pueden cerrarse con Escape cuando no están enviando. Si una solicitud falla, el formulario conserva lo escrito. Una cuenta sin permisos ve una explicación; un listado sin datos muestra un estado vacío, distinto de un error de servicio.

Cerrar sesión elimina la sesión y los datos protegidos de la interfaz. Si otra persona revoca tu acceso, la siguiente comprobación del servidor debe impedir continuar en ese espacio.

## Qué falta

Todavía no hay carga de documentos, extracción de facturas, tarifas, comparación de conceptos ni reclamos. Las pantallas de esta versión administran el acceso al futuro espacio de trabajo; no muestran métricas o análisis simulados.

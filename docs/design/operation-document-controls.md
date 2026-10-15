# Controles compactos de operación y documentos

Blueprint previo a frontend, 2026-10-15, /root/analysis_ux. Roles UX, visual y accesibilidad; conservar operation-usability.md y componentes actuales. Alcance: jerarquía de acciones, metadatos de documentos y consulta; no alterar originales ni reglas financieras.

## Cabecera de operación

Referencia y nombre a la izquierda; a la derecha un grupo compacto Editar operación (secundario), Recargar (ghost/discreto) y Analizar/Volver a analizar (principal). En móvil el grupo se ajusta en filas sin separar botones por toda la pantalla. No duplicar refresco debajo de la cabecera ni añadir tarjetas. Estado de actualización local dentro del botón, sin desplazar contenido.

Cuando Analizar esté deshabilitado, mostrar una explicación breve visible junto al grupo: falta documento, análisis en curso, permisos en comprobación o causa real del contrato. Tooltip complementario con el mismo motivo, nunca único acceso: el botón nativo disabled no recibe foco, por lo que usar un contenedor enfocable con nombre/aria-describedby o exponer explicación en texto contiguo. No simular un botón disponible con click ignorado. Viewer conserva nota de permiso y no acciones de escritura. Deshabilitar por una condición no significa factura válida ni bloqueo contable.

## Editar documento desde tabla

Acción discreta Editar datos en cada fila autorizada. Diálogo con Nombre y Tipo etiquetados; deja claro que son metadatos y el PDF original no cambia. Nombre se muestra como texto, nunca HTML, con longitud validada y extensión según contrato. Tipo ofrece únicamente tipos admitidos. Advertir que cambiar tipo puede cambiar los datos utilizados en análisis y requerir revisión/reanálisis; no anunciar reprocesamiento si el backend no lo realiza. Guardar tiene loader y evita duplicados; error conserva borrador, conflicto muestra datos vigentes y exige revisión antes de reintentar. Cancelar restaura foco a la acción de esa fila. Lector consulta sin editar.

Mostrar nombre actualizado en listas y detalle sin reescribir nombres de documentos dentro de snapshots históricos. Las operaciones vinculadas son relaciones reales; enlace abre su operación autorizada. Cero asociaciones dice Sin operación vinculada; no confundir con ausencia de acceso ni inventar conteos. Si lista parcial, indicar límite y acceso al resto solo cuando exista.

## Consulta y ordenación

Buscar con etiqueta visible y alcance explícito: nombre de documento, referencia/nombre de operación según contrato. Si es búsqueda servidor, conservar paginación y resetear a primera página al cambiar término; no filtrar solo la página y presentarlo como todo el catálogo. Mensaje Sin resultados distinto de Sin documentos; Limpiar búsqueda real. Ordenación por controles semánticos con nombre y dirección visibles, aria-sort en cabecera activa si se usan botones de tabla; conservar criterio al paginar. No habilitar columnas sin orden soportado por servidor. Loading local y datos retenidos seguros durante refresh; autorización fresca prevalece.

## Aceptación

Revisar grupo de acciones escritorio/móvil320/390 y zoom200; explicación disabled legible por teclado y hover, no tooltip exclusivo; edición nombre/tipo/pending/error/conflicto/foco; vínculo operación real y viewer; búsqueda más allá de25 elementos, paginación/orden/cero resultados. Evidencia de navegador distingue fixtures de pruebas reales API. Actualizar doc con contratos finales sin prometer campos/operaciones no implementadas.

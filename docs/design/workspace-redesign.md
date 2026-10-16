# Workspace compacto — rediseño

Blueprint previo a implementación, 2026-10-16, /root/analysis_ux. Roles UX/visual/UI/accessibilidad. Conserva límites de producto y autorización del repositorio. Nueva dirección expresamente autorizada: navegación de workspace, Inter, acento naranja y paneles laterales. Obra Community sigue siendo referencia conceptual acreditada; nodos exactos inaccesibles, sin promesa de copia al píxel ni assets importados.

## Navegación y jerarquía

Sidebar compacto con selector de organización contextual y destinos Resumen, Operativa y Equipo. Al abrir organización, destino predeterminado Resumen. Operativa contiene tabs/enlaces Operaciones, Documentos y Tarifas; Equipo contiene Miembros e Invitaciones. No repetir las cinco secciones en un menú plano. Mantener URLs profundas existentes funcionales mediante mapeo; volver a operación/documento no pierde organización. Navegación activa identifica sección y subpágina con aria-current. El selector solo enumera organizaciones realmente autorizadas, limpia contexto anterior al cambiar y nunca usa activeOrganizationId como permiso.

Encabezados 20–22px, cuerpo Inter 14px con fallback system, metadatos12px; sin hero ni excesivo espacio vacío. Sidebar ~220px y topbar ~56px; main usa ancho disponible y padding20–24px. Móvil colapsa navegación en un control accesible o fila compacta, manteniendo selector y cierre de sesión alcanzables. No ocultar destino activo ni depender de hover.

## Tokens visuales

Superficies blancas; fondo #F2EFE9, texto #2F3238, metadatos #8A8F98 solo donde el contraste sea suficiente, bordes neutros. #FF7A18 es acento/indicador con texto oscuro; no usar texto blanco pequeño sobre naranja sin medir contraste. #FFB26B es superficie/acento secundario. Para texto secundario pequeño usar un gris más oscuro si #8A8F98 falla contraste. Preservar rojo/verde/ámbar financieros con texto e icono: naranja de marca nunca sustituye advertencia ni hace parecer una diferencia aceptada. Foco oscuro visible 2px, no solo naranja tenue. Inter instalada/local según adopción real, sin depender obligatoriamente de terceros en runtime.

## Resumen con datos reales

KPI compactos de operaciones/documentos/controles/reclamos solo cuando un endpoint agregado autorizado devuelve definición y cantidad completas. No sumar monedas ni presentar importe cuestionado como recuperado. Gráfico pequeño con período, unidad y etiquetas; usar datos reales y alternativa textual/tabular accesible. Cero es dato válido, ausencia/error no se disfraza como cero. No crear tendencias inventadas de un único total. Pendientes accionables enlazan a operación/documento/reclamo concreto: extracción fallida, revisión o seguimiento según contratos. Si solo se conocen los primeros N resultados, mostrar alcance y no afirmar total global. Carga/error/empty propios para cada región; una falla parcial no vacía todas las demás.

## SidePanel unificado

Todos los diálogos actuales de tareas pasan a panel derecho reutilizable basado en el primitivo modal accesible existente: overlay, nombre/descripcion, foco inicial, Tab atrapado, Escape seguro y retorno al trigger. Desktop ancho420–560px según formulario; móvil ancho100vw, altura100dvh con safe-area. Cabecera fija con título/cerrar; cuerpo min-height0 con scroll vertical; footer fijo con acciones Cancelar/Guardar y estado. Formulario debe mantener semántica submit aun cuando footer esté separado: asociación form/id o composición dentro del form con grid/flex. No cortar botón final detrás del teclado o scroll de página.

Panel no se cierra al refrescar datos en background. Datos cambiados conservan borrador y exigen revisión explícita conforme al contrato. Pending impide duplicado/cierre accidental; spinner local, no overlay global. Un panel a la vez: evitar dos focus traps o overlays superpuestos. Cerrar abandona borrador solo según la interacción actual; no fingir cancelar un job ya persistido. También invitaciones, registro de seguimiento, correcciones y formularios largos deben usar el mismo patrón.

## DataTable compartida

TanStack Table con definición tipada de columnas y presentación compartida, manteniendo HTML table/caption/th scope/aria-sort y región horizontal nombrada. DSL declarativa reutiliza toolbar, búsqueda, filtros admitidos, orden, selección si realmente usada, loading/error/empty y paginación. No imponer búsqueda cliente sobre una página del servidor ni ordenar solo los25 registros fingiendo catálogo global. Cada listado declara modo servidor/cliente y recibe total real/callbacks; columnas de acciones no se ordenan. Controles de filtro tienen etiquetas; resultado count y dirección visibles. Paginación conserva criterios y resetea página al cambiarlos.

Aplicar a organizaciones, operaciones, documentos, tarifas, miembros, invitaciones y demás listados donde existan, con excepciones documentadas si una tabla de evidencia detallada necesita composición especial. Evitar convertir filas completas en botones; links y acciones accesibles explícitos. Datos largos envuelven o exponen contenido completo; móvil solo scroll interno de tabla, nunca desborde global.

## Aceptación antes de cierre

Verificar rutas antiguas y nuevos destinos predeterminados; selección de organización con respuestas tardías/revocación; permisos viewer; agregado real frente a páginas parciales; gráfico con lectura textual. Inventariar todos los usos del antiguo Dialog y confirmar panel lateral, header/footer/cuerpo scroll, foco/Escape/retorno y formularios largos a320/390px+200%zoom. Medir contraste de naranja y grises con estilos reales. Comprobar DataTable búsqueda/orden/paginación globales y estados vacío/cargando/error sin datos ficticios. Browser fixtures prueban UI; autorización, KPIs completos y backend requieren pruebas independientes. No afirmar certificación de accesibilidad ni fidelidad exacta a Figma.

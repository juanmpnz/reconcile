# Referencia de diseño aceptada

Estado: base de diseño aceptada por el usuario el 2026-10-14; pendiente de inspección de componentes/nodos concretos. No se ha duplicado ni creado un archivo Figma.

Obra shadcn/ui Community Edition: https://www.figma.com/community/file/1514746685758799870/shadcn-ui-kit-community-edition

Encaja con React y shadcn/ui y ofrece componentes, variables y auto layout. La documentación oficial de shadcn/ui lo incluye como kit gratuito: https://ui.shadcn.com/docs/figma. No se afirma identidad exacta entre cada variante del kit y las versiones de código que instalemos.

Licencia vigente consultada el 2026-10-14: Community Edition bajo CC BY 4.0; permite uso comercial y adaptación con atribución a Obra Studio BV, enlace de licencia e indicación de cambios. Los componentes/blocks Pro no forman parte de esta selección. Fuente: https://shadcn.obra.studio/license, sección 11. Respetar atribución al incorporar material derivado; no atribuir MIT basándose en publicaciones antiguas.

Antes de implementar pantallas: UX define bandeja y revisión; visual-designer fija tokens y variantes; ui-engineer/maquetador implementa; frontend integra estados/datos; accessibility-reviewer y QA comprueban interacción y fidelidad visual. Registrar en Figma los estados, anchos de referencia, tipografía, tamaños, espacios y comportamiento responsive. Una comparación al píxel necesita nodos exactos, assets y capturas bajo viewport y fuentes equivalentes; no basta con un enlace al kit.

La ficha Figma no se pudo inspeccionar por web en esta sesión. Se verificaron disponibilidad gratuita y licencia en documentación del autor. No se promete cobertura completa de todas las pantallas ni plugins gratuitos adicionales.

## Renovación de identidad — 2026-10-15

Dirección solicitada por el usuario: blanco y negro, tipografía de sistema, títulos contenidos, ocupación útil de pantalla y administración mediante tablas. La especificación ejecutable está en identity-interface.md. Se consultaron las páginas oficiales de shadcn/ui Table/Dialog y Radix Dialog para composición e interacción.

La implementación usa componentes propios reutilizables y el primitivo accesible @radix-ui/react-dialog, con CSS y tokens locales. No se presenta como instalación del CLI shadcn ni de Tailwind, ni como copia de nodos del Figma Community. No se importaron assets del kit. Obra Studio BV permanece acreditado como referencia aceptada; se mantiene la limitación de inspección exacta.

Referencias de componentes: https://ui.shadcn.com/docs/components/radix/table, https://ui.shadcn.com/docs/components/radix/dialog, https://www.radix-ui.com/primitives/docs/components/dialog.

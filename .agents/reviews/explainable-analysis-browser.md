# Fase 3 — revisión independiente de interfaz en navegador

Revisor: `/root/analysis_product_domain`, ejecución QA de navegador distinta de `/root/analysis_frontend`. Roles qa-engineer y accessibility-reviewer. Independiente **de la implementación de UI**: este agente no escribió ni modificó React/CSS/API frontend. Este agente sí definió producto y escribió el motor financiero; esta revisión no se presenta como revisión independiente de esas reglas.

Leídos perfiles QA/accesibilidad, AGENTS/workflow, docs/design/analysis-workspace.md, contratos y componentes actuales. Se ejecutó React compilado mediante Vite y servido por preview, Chromium 153 con Playwright 1.62.1. Las respuestas HTTP son fixtures explícitos en el driver: no prueban autenticación real, PostgreSQL, tenant backend, PDF ni jobs financieros de punta a punta. Esas verificaciones pertenecen a las pruebas de servicios del otro agente.

## Ejecución y resultados

Comando: `node /tmp/reconcile-analysis-qa/run-ui.mjs`, desde la raíz del repositorio. Driver y capturas son evidencia transitoria interna en `/tmp/reconcile-analysis-qa/`; resultados estructurados en `results/results.json`. Ejecución final estable: **17/17 grupos pasados**. Una ejecución previa usó un fixture desactualizado del historial; se corrigió el driver al contrato real y se repitió, sin modificar producto para satisfacer pruebas.

- Carga inicial con estado legible, error y reintento, navegación real de listado a operación.
- Creación: teclado y trampa de foco, pendiente, Escape bloqueado durante envío, error con foco y campos conservados, éxito.
- Asociación de documentos: selección, pendiente, error conserva selección, éxito y devolución de foco.
- Revisión: motivo requerido, vacío viaja como null y cero como cadena explícita, error conserva borrador y motivo, revisión guardada; decimal inválido no produce petición.
- Análisis: error de solicitud, reintento conserva clave de idempotencia, cola desactiva doble lanzamiento, resultado y evidencia literal (texto no ejecutable), historial reciente y señal de datos modificados.
- Historial completo: recuperar ejecución antigua inmutable aunque la actual falló, mostrar resultado y obsolescencia sin sustituirlo por datos nuevos.
- Polling de análisis en curso conserva el modal y su borrador; Escape devuelve foco al botón exacto.
- Lector consulta hallazgos sin botones de crear, vincular, revisar o analizar.
- Anchos 390/320 y CSS zoom 200%: sin desbordamiento horizontal del documento; tablas mantienen región propia desplazable; formulario se mantiene dentro del viewport.
- Lista vacía ofrece crear sin mostrar resultados falsos. Comprobación fresca de permisos oculta temporalmente el modal, conserva y devuelve el borrador tras autorización; revocación posterior oculta datos y portal.
- Movimiento reducido: spinner estático con etiqueta legible.
- Creación que termina tras navegar no redirige a una operación anterior; respuesta tardía de otra organización no aparece en el nuevo ámbito.

Capturas examinadas visualmente: desktop-result.png, mobile320-operation.png y mobile320-facts-dialog.png. Capturas adicionales: desktop-operation.png, mobile390-operation.png, mobile390-facts-dialog.png y desktop-css200-operation.png. Se conserva el diseño compacto monocromo aceptado. No se declara fidelidad píxel a Figma ni certificación de accesibilidad/lector de pantalla.

## Huella de fuente examinada

SHA-256:

```text
58657cac0b8264a63c59cdd554e349f67b9c9090f32b2cdf3054889075d3994d apps/web/src/app/app.tsx
8fe09671b7f42c11191ed998294c87c39193b66616ce80627d00e656c38526d6 apps/web/src/features/operations/api.ts
be62dd948bfac98578986d701464889800d4751a7e284f309c1e43a0d4af5ab3 apps/web/src/features/operations/facts-editor.tsx
00a672692cea4a48c88061b9e0dbdaf3ad8189993e234b37835accb92f195404 apps/web/src/features/operations/link-dialog.tsx
2fa60c4c70b5634228b94f378edf4d0e634a6cc3ad342d0247ea45cb406965f5 apps/web/src/features/operations/operation-detail.tsx
01a80d48668d81284c40413b9edf80b5aef0ae0c3f2768c0d552d9a735445c04 apps/web/src/features/operations/operation-list.tsx
75c201decaf265d139abdc7f58e533656373e1ec693af1ed1d03981f0c740a03 apps/web/src/features/organizations/organization-detail.tsx
214500ead8924a37c5cb7353a23398dfdb608d1b2808f5b3f254e84e1537e790 apps/web/src/styles.css
93618faf99e8e50013f3bfad5ce78ae83e6f50854f4012fdd451e86bd76ff26b packages/contracts/src/analysis.ts
7155432f7a363e2407833c5e7eaa37fafaf338d0306954265878834bf3b3d501 apps/web/src/features/operations/warnings.tsx
```

No hay hallazgos críticos/altos abiertos de UI en este alcance. La corrección del modal durante polling se verificó por comportamiento, no solo lectura del código. No se han probado entrega real SMTP, producción, navegación con datos reales ni tecnologías de asistencia completas.

## Comprobación adicional de capturas de viewport

Se repitieron los grupos de resultado y móvil con `fullPage:false`, escritorio situado en `scrollY=0` y dos cuadros de animación esperados. `desktop-result-viewport-top.png` y `mobile320-facts-dialog-viewport.png` examinadas: sidebar de escritorio empieza en y=0 (200 × 1000), enlace de salto permanece oculto (`position:fixed; top:-100px`, rect y=-100), modal móvil comienza con margen de 16px y mantiene scroll interior. El desplazamiento aparente de elementos sticky/fijos en la captura full-page anterior era propio de la captura de Chromium tras scroll a evidencia, no un cambio de CSS. No se modificó código de producto para esta comprobación.

## Cierre de avisos por documento (UIA4)

Tras la corrección final de presentación de avisos se reconstruyó la aplicación y se ejecutaron nuevamente los 17 grupos completos, salida 0. Dos grupos nuevos comprueban un documento actual sin extracción mostrando filename y motivo legible, y un aviso histórico de documento desvinculado con fallback legible y código desconocido sin exponer UUID/código interno. Capturas desktop-current-warning-viewport.png y desktop-historical-warning-viewport.png; esta última examinada visualmente. La huella actual de operation-detail y warnings.tsx está incluida arriba. La revisión corresponde al árbol de trabajo posterior a 793afc70a715724f59882193bed764692e55d313, con el cambio de avisos aún por publicar al ejecutar estas pruebas. Prueba definitiva estructurada: results/results.json, 17 registros passed=true; no usar copias de intentos anteriores.

# Flujo obligatorio de expertos

## Fuente de verdad y activación

AGENTS.md y este archivo gobiernan el trabajo. .agents/manifest.json cataloga roles y rutas; los perfiles contienen responsabilidades. Los adaptadores de Codex y Claude se generan desde ese catálogo, sin duplicar reglas. No son agentes residentes ni se ejecutan por el mero hecho de existir en git.

En cada tarea, el agente principal asume principal-engineer y aplica el flujo. Usar subagentes reales cuando el entorno los permita; enviarles el rol canónico, tarea acotada y archivos. Si el runtime no descubre los adaptadores, el principal debe cargar el perfil al delegar. Si no hay delegación disponible, ejecutar pasos secuenciales declarados como tales. Nunca presentar autorrevisión como revisión independiente ni simular especialistas que no se ejecutaron.

Para cambios sustanciales de código, dinero, identidad, integraciones o infraestructura se requiere revisión independiente pertinente antes de marcar verificado. Si no está disponible, avanzar implementación y pruebas autorizadas, registrar la limitación y dejar el estado reviewed; no pedir confirmación de rutina ni afirmar validación inexistente. Las instrucciones del usuario y del runtime prevalecen sobre este flujo.

## 1. Brief y selección antes de implementar

Leer estado y requisitos; registrar una tarea en .agents/tasks a partir de la plantilla. Incluir objetivo, aceptación observable, exclusiones, caminos afectados, experto responsable, roles aplicables, changeClass, risk y decisión booleana independentReviewRequired con independenceRationale. Riesgo medio/alto y trabajo de seguridad exigen revisión independiente de un especialista pertinente; la del coordinador por sí sola no satisface ese requisito. Evaluar todas las rutas del manifiesto y añadir roles semánticos que no se deduzcan del nombre del archivo.

Nuevas capacidades o reglas de negocio: product-manager y especialista sectorial antes de codificar. Cambios de límites, identidad, esquema, contratos o jobs: solution-architect. Flujos nuevos/modificados: ux-designer y visual-designer antes de maquetar. La ausencia de estos disparadores se justifica con una nota breve; no obliga a convocar todos los roles por cada typo.

Las rutas son un mínimo: cada rol sugerido requiere revisión o exclusión explícita con motivo. Una ruta no conoce la semántica ni sustituye el análisis del principal. No usar exclusiones para evadir un riesgo aplicable.

## 2. Decisiones y contratos

Producto fija aceptación; dominio define condiciones y evidencia necesaria; arquitectura fija límites y contratos. Diseño define estados y jerarquía. Registrar decisiones materiales con ADR y resolver contradicciones antes de implementar el área dependiente. No bloquear trabajo independiente por una duda que no lo afecta.

## 3. Implementación por especialistas

Asignar frontend-engineer, backend-engineer, ui-engineer, data-engineer, integration-engineer, document-ai-engineer o platform-engineer según alcance. Determinar propietarios de archivos para evitar ediciones concurrentes. Compartir contexto y contratos, no snapshots de secretos. El implementador no puede certificar su propia independencia.

## 4. Revisión y QA

Los expertos pertinentes revisan el diff y devuelven hallazgos concretos; QA verifica aceptación y escenarios negativos con las pruebas proporcionales al cambio. Seguridad es obligatoria en identidad, aislamiento, credenciales, uploads, redes externas y procesamiento con IA. Accesibilidad y maquetación revisan cambios de UI. Plataforma revisa CI, dependencias, imágenes, migraciones y recuperación.

La revisión independiente proviene de otra ejecución/agente o persona y registra identidad real. Registrar su alcance exacto; si no reexamina una corrección posterior, no atribuirle aprobación de esa corrección. La verificación secuencial del principal sigue siendo útil, pero no se etiqueta independiente.

Hallazgos critical/high abiertos bloquean el estado verified. Un resultado de test no cierra automáticamente un hallazgo; registrar la corrección/evidencia. No escribir tests triviales de texto ni repetir todos los checks después de un cambio sin relación; mantener las comprobaciones necesarias para el comportamiento afectado y los gates existentes.

## 5. Cierre y evidencia

Completar la tarea: rutas revisadas, roles, identidad de revisor, revisión independiente o secuencial, pruebas con comando/resultado/evidencia, hallazgos resueltos/abiertos, checks no ejecutados y limitaciones. Actualizar docs/status.md sin describir propuestas como implementadas. Los resultados de CI se atribuyen a su SHA/ejecución; no extrapolarlos a cambios posteriores.

Estados de tarea: planned, implementing, reviewed, verified, blocked. Las revisiones se registran en orden cronológico y usan passed, changes-requested o not-run. La última revisión de cada rol requerido determina su estado vigente. Los tests usan passed, failed o not-run. Las exclusiones explican por qué un rol no aplica. No poner una tarea en verified si faltan roles aplicables, pruebas de aceptación o revisión independiente exigida.

## Evidencia que devuelve cada especialista

- Rol, identidad/ejecución, modo independiente o secuencial, alcance y revisión examinada.
- Archivos/símbolos, comandos/resultados y documentos de referencia realmente consultados.
- Hallazgos: severidad, problema observable, impacto y corrección o motivo de cierre.
- Estado y límites: qué no se probó, incertidumbre y siguiente acción concreta.

## Automatización y límites

`pnpm harness:check` valida catálogo, perfiles, adaptadores y registros. `pnpm harness:gate -- --base <sha>` comprueba la cobertura de roles declarada para el diff de git usando registros de tareas modificados. CI ejecuta ambos, sin quitar lint, tipos, pruebas o smoke.

Los scripts comprueban estructura y evidencia declarada; no certifican que un especialista haya trabajado ni que una solución sea correcta. No llaman modelos ni consumen credenciales. Las tareas verified deben tener trazas humanas o de agentes consultables. No guardar conversaciones enteras, secretos ni documentos de clientes en esas trazas.

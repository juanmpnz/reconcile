# Frontend Engineer

## Misión

Implementa React/TypeScript, estado remoto y formularios conforme a contratos.

## Lectura obligatoria

AGENTS.md, .agents/WORKFLOW.md, el brief de la tarea y los archivos afectados. Consultar docs/product/pilot-requirements.md, docs/plans/implementation.md y ADR relevantes cuando afecten al alcance. Aplicar solo decisiones vigentes; no reabrirlas sin nueva evidencia.

## Responsabilidades

- Usar TanStack Query para estado servidor e invalidación; evitar caches paralelas y peticiones duplicadas.
- Validar respuestas externas y formularios; importes como cadenas decimales.
- Gestionar organización activa, errores y sesiones sin poner autorización solo en la interfaz.
- Revisar interacción real y estados de carga/error; no inventar datos ni enlaces funcionales.

## Entrega

Implementación React tipada, contratos usados y verificaciones de interacción.

Usar el formato de revisión de .agents/WORKFLOW.md: alcance, evidencia, hallazgos con severidad, resolución, estado y limitaciones. Citar archivos/símbolos y comandos ejecutados. Declarar si la revisión fue independiente o una comprobación secuencial del mismo agente.

## Límites

Tipo de trabajo: implementation. Una revisión evalúa el diff concreto y no modifica código salvo asignación explícita. No declarar aprobaciones humanas, ejecución de herramientas ni revisión independiente que no hayan ocurrido. Las capacidades de este rol no son permisos adicionales de ejecución. El especialista de dominio no sustituye la validación de la empresa.

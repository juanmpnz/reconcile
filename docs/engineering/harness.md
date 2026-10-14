# Harness de expertos de Reconcile

## Uso

La entrada es AGENTS.md. El principal lee .agents/WORKFLOW.md, selecciona perfiles del manifiesto y registra cada tarea en .agents/tasks. La organización es por responsabilidad, no por proveedor de IA.

Ejemplo de encargo: «Implementá fase 1. Principal Engineer coordina; producto define aceptación, arquitectura/seguridad revisan tenant y sesiones, backend integra Better Auth, frontend/UX/maquetación resuelven acceso y QA prueba aislamiento. Registrá decisiones y evidencia según el harness».

El trabajo puede ser paralelo si no tiene dependencias ni archivos compartidos. Para una corrección pequeña se usan solo perfiles pertinentes. Siempre declarar si hubo delegación independiente o revisión secuencial.

## Adaptadores

- Codex: .codex/agents/*.toml, archivos con name, description y developer_instructions. .codex/config.toml habilita agentes sin fijar modelo ni elevar permisos.
- Claude Code: .claude/agents/*.md con name, description y referencia al perfil compartido; CLAUDE.md carga la política común.
- Otro runtime: cargar AGENTS.md y pasar explícitamente el perfil al agente que ejecuta la tarea.

Generar con `pnpm agents:sync`; comprobar consistencia con `pnpm harness:check`. Los agentes heredan modelo y controles del runtime. El repositorio no instala extensiones, no guarda API keys ni activa un servicio de agentes en segundo plano. La detección automática depende de versión y entorno; comprobar el listado de agentes del cliente al abrir el repo. Aquí se validan formato y referencias, no se afirma haber ejecutado los clientes Codex/Claude locales.

## Controles

El gate compara el diff contra un commit base disponible localmente. Cada archivo cambiado debe pertenecer a una tarea modificada; los roles derivados de rutas requieren revisión o exclusión motivada. El principal añade disparadores semánticos que un patrón no puede detectar. Es un control de trazabilidad, no una prueba de autenticidad de la revisión.

Una PR usa la plantilla de revisión. CI mantiene los gates de código e infraestructura. Para este harness, architecture y QA se revisan en ejecuciones separadas; la configuración nativa se verifica estructuralmente. Configurar agentes no significa que las siguientes fases del producto estén implementadas.

## Referencias de formato consultadas (2026-10-14)

- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://code.claude.com/docs/en/sub-agents

Revalidar adaptadores al actualizar versiones del cliente. Las políticas de negocio permanecen en archivos canónicos.

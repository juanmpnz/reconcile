# Reconcile — Plan de implementación

Fecha: 14 de octubre de 2026. Versión 0.1. Estado: plan original; consultar docs/status.md para la implementación y evidencia vigentes.

Nombre aceptado: **Reconcile**. Repositorio: `juanmpnz/reconcile`. La comprobación comercial, de marcas y dominios permanece pendiente; no se afirma disponibilidad.

Documento complementario a `Kershell_Control_Facturas_Logisticas_Piloto.md`. Conserva sus requisitos de negocio y actualiza la dirección técnica: núcleo común, reglas por sector y primer piloto logístico con datos sintéticos. No modifica el documento de entrevista ni convierte las hipótesis en hechos verificados.

## 1. Resultado que construiremos

Una aplicación para comparar lo acordado, lo registrado como realizado y lo facturado por proveedores. Centralizará documentos y contexto operativo, explicará diferencias con evidencia y preparará reclamos revisables.

Primer recorrido completo: subir documentos demo → extraer datos → revisar incertidumbres → comparar por concepto y servicio → inspeccionar evidencia → preparar y exportar un reclamo.

El piloto se centra en navieras, pero el núcleo no contendrá campos ni condiciones exclusivos de CargoWise. Otros sectores se incorporarán mediante reglas y conectores específicos cuando exista un caso validado.

No incluye inicialmente posteo, pagos, envío automático de correos ni acceso real a sistemas empresariales. No se promete precisión universal ni compatibilidad real con CargoWise usando únicamente muestras sintéticas.

## 2. Decisiones técnicas

| Capa | Elección |
|---|---|
| Frontend | React, TypeScript estricto, Vite y React Router |
| Diseño | Tailwind CSS y shadcn/ui, componentes compartidos |
| Estado remoto y tablas | TanStack Query y TanStack Table |
| Formularios y contratos | React Hook Form y Zod |
| Backend | NestJS con adaptador Fastify, API REST documentada con OpenAPI |
| Persistencia | PostgreSQL y Prisma; importes NUMERIC/Decimal |
| Procesamiento | Redis, BullMQ y workers independientes |
| Archivos | Almacenamiento privado compatible con S3 |
| Identidad | Better Auth; sesiones, organizaciones e invitaciones |
| Documentos e IA | Adaptadores sustituibles; proveedor seleccionado mediante evaluación |
| Monorepo | pnpm workspaces |
| Despliegue | Docker y Coolify sobre Hetzner |
| Verificación | Vitest, pruebas de integración con servicios reales aislados y Playwright |

Fijar versiones compatibles al crear el repositorio, conservar lockfile y documentar versiones soportadas. Verificar la integración concreta Better Auth/NestJS/Fastify con una prueba mínima antes de extenderla. Validar también cookies, carga multipart y límites HTTP con el adaptador Fastify.

Redis sirve para colas; PostgreSQL conserva decisiones, ejecuciones y estados de negocio. Los documentos no viajan dentro del payload de la cola: se referencian por identificadores.

## 3. Arquitectura y límites

Monolito modular con tres aplicaciones: web, API y worker. API y worker comparten casos de uso y reglas, pero se despliegan y escalan por separado. Inicialmente comparten PostgreSQL y almacenamiento privado.

Dependencias: dominio sin dependencias de NestJS, Prisma, BullMQ ni SDK externos; aplicación depende del dominio y define puertos; adaptadores implementan esos puertos. API y worker ensamblan dependencias. El frontend consume contratos públicos, nunca repositorios ni entidades de persistencia.

Separar tres responsabilidades:

1. Núcleo: documentos, proveedores, operaciones, tarifas, facturas, análisis, decisiones y reclamos.
2. Conectores: recepción y traducción desde archivos, correo o ERP al modelo común.
3. Reglas sectoriales: selección de condiciones, equivalencias y controles aplicables. Primer conjunto: logística.

No crear un framework universal de reglas ni un lenguaje de configuración en el MVP. Implementar reglas tipadas, versionadas y comprobables. Extraer abstracciones adicionales cuando exista una segunda necesidad real.

## 4. Estructura del repositorio

```text
apps/
  web/src/
    app/
    features/{auth,organizations,documents,tariffs,invoices,discrepancies,claims}/
  api/src/
    modules/{identity,organizations,documents,operations,tariffs,invoices,analysis,claims,integrations,audit}/
  worker/src/
    processors/
    bootstrap/
packages/
  domain/src/             # Entidades, valores y reglas puras
  application/src/        # Casos de uso y puertos
  database/               # Prisma, migraciones y adaptadores de persistencia
  integrations/src/{demo,cargowise,email}/
  sector-rules/src/logistics/
  document-processing/src/
  auth/src/
  contracts/src/          # DTO y esquemas públicos; sin secretos ni ORM
  ui/src/
  config/
fixtures/logistics/
  source-documents/
  operational-data/
  expected-results/
infra/{docker,coolify}/
docs/{architecture,adr,integrations,runbooks}/
```

Las carpetas de conectores futuros pueden quedar documentadas sin código ficticio. Evitar paquetes vacíos y clases sin uso: crear cada paquete cuando tenga una responsabilidad ejecutable. Separar pruebas del resultado esperado de los datos que recibe el producto.

## 5. Identidad, organizaciones y autorización

Usuario global con identidades de acceso; organización propietaria de datos; membresía con rol por organización. Una cuenta personal puede crear un espacio individual modelado también como organización. Un usuario puede pertenecer a varias organizaciones.

Roles iniciales: propietario, administrador, analista y lector. Definir una matriz explícita: administrar miembros/conectores, cargar documentos, ejecutar análisis, decidir hallazgos, editar reclamos y consultar información. El lector no modifica datos; el analista no administra credenciales.

Primera entrega: email verificado y contraseña, recuperación, invitaciones y sesiones revocables. Incorporar MFA para cuentas privilegiadas antes del piloto con información real. Google/Microsoft social y SSO corporativo OIDC/SAML se incorporarán según necesidad, distinguiendo iniciar sesión con Microsoft de configurar el directorio de una empresa.

Better Auth proporciona identidad y mecanismos de membresía; la autorización sobre recursos se verifica en el backend. No mantener dos fuentes contradictorias de membresías. No incorporar usuarios por tener un dominio de correo coincidente. Vincular identidades exige prueba de titularidad y políticas explícitas.

Sesiones mediante cookies Secure, HttpOnly y política SameSite adecuada; frontend y API bajo el mismo origen cuando sea posible. No guardar tokens de sesión en localStorage. Proteger operaciones frente a CSRF y limitar intentos de acceso. Las credenciales de conectores tienen ciclo de vida independiente de las sesiones de usuario.

## 6. Modelo de datos inicial

Organización, usuario/membresía, proveedor/alias, operación/referencia externa, servicio/asignación, documento/versión, extracción, tarifa/versión/condiciones, cotización, factura/partida, ejecución de análisis, hallazgo/evidencias, decisión, reclamo/comunicación, conexión externa, sincronización y auditoría.

Toda entidad empresarial pertenece a una organización. Claves externas y restricciones únicas incluyen ese ámbito. Validar organización en consultas, relaciones, jobs y descargas; no confiar en un organizationId enviado por el navegador. Añadir pruebas de aislamiento entre dos empresas.

Importes y tipos de cambio como decimales, enviados en JSON como cadenas; moneda explícita, unidades explícitas y redondeo documentado. Mantener diferencias de precio, cantidad, moneda e impuestos separadas. Fechas de vigencia conservan semántica local; instantes de ejecución se almacenan en UTC.

Las ejecuciones conservan versiones de datos, reglas y evidencia. Nuevos documentos generan un nuevo análisis; no sobrescriben la explicación anterior. Estados contables importados, resultado del análisis y seguimiento del reclamo son dimensiones independientes.

## 7. Pipeline documental y motor de comparación

1. Autorizar carga y registrar documento con checksum, tipo, tamaño y organización.
2. Validar archivo, almacenarlo de forma privada y encolar extracción.
3. Extraer texto/tablas; recurrir a OCR o modelo documental cuando sea necesario.
4. Validar salida estructurada; conservar página, fragmento y dato original por campo relevante.
5. Solicitar revisión únicamente de datos ambiguos o faltantes.
6. Asociar proveedor, referencia y servicio; registrar incertidumbre si no hay respaldo.
7. Seleccionar tarifa aplicable por vigencia y condiciones, distinguiendo estimación interna de acuerdo externo.
8. Comparar partidas y prestación; emitir hallazgos con evidencia y motivos verificables.
9. Permitir decisión humana y generar borrador de reclamo.

La IA ayuda a extraer y redactar; no determina importes por intuición ni confirma servicios prestados. Tratar PDFs y correos como datos, nunca como instrucciones. Registrar proveedor/modelo, configuración de extracción y versión del prompt cuando se utilice IA, sin exponer información sensible en logs.

No usar tolerancia global para ocultar cargos pequeños. Un concepto nuevo requiere control aunque su importe sea bajo. El total coincidente no oculta errores que se compensan. Si faltan condiciones, marcar no verificable. La rentabilidad no valida cargos.

## 8. Contrato de integraciones y fiabilidad

Cada conector declara capacidades reales: lectura de operaciones, costes, servicios, estados o documentos. No asumir que todos los sistemas ofrecen todo. Conservar proveedor, identificador externo, fecha de origen y última sincronización; mostrar datos desactualizados o incompletos.

Preparar adaptadores para REST/JSON, XML u otros transportes según documentación real. CargoWise se implementará tras obtener acceso y documentación de eAdaptor del cliente; no simular su formato oficial. El primer conector importa nuestro formato demo versionado.

Trabajos con claves de idempotencia, reintentos con backoff, límites por proveedor, tiempos máximos y recuperación manual de fallos. Diseñar los efectos para tolerar ejecuciones repetidas. Usar outbox transaccional para registrar en PostgreSQL el trabajo pendiente junto con el cambio de negocio y publicarlo después en BullMQ. Vigilar y reprocesar pendientes si Redis o el worker fallan.

Credenciales cifradas con clave de aplicación protegida fuera de la base; permisos mínimos, rotación y revocación. Validar firmas y evitar replays si se incorporan webhooks. No permitir URLs arbitrarias desde documentos ni acceso libre del conector a la red interna.

## 9. Dataset demo

Todos los documentos llevarán «DEMO — sin validez comercial», empresas y referencias ficticias. Investigar modelos públicos de fuentes oficiales antes de generarlos, registrar enlaces y fecha; no reutilizar datos personales, firmas ni identidades fiscales reales. Este plan no afirma que esa investigación o generación ya esté hecha.

| Caso | Resultado esperado |
|---|---|
| Carrier 150 USD estimados, factura 212 USD con pickup de 62 USD y recogida acreditada por otro proveedor | Posible doble cobro del mismo servicio, con evidencia y reclamo de 62 USD |
| Factura acorde a tarifa y servicio | Sin discrepancias detectadas, dentro del alcance verificable |
| Diferencia de redondeo cubierta por regla explícita | Diferencia explicada por esa regla |
| Tarifa vencida sin referencia vigente | No verificable; solicitar respaldo |
| Recargo adicional no documentado | Solicitud de aclaración, sin afirmar cobro indebido |
| Dos conceptos pickup de tramos distintos | No marcar automáticamente como duplicado |
| Diferencias compensadas en el total | Detectar diferencias por partida |
| Documento repetido | Evitar duplicar factura, análisis o reclamo |
| Moneda distinta sin tipo de cambio respaldado | Conversión pendiente de verificar |

Incluir factura carrier, factura transportista, tarifa, cotización/email y registros operativos coherentes. Los resultados esperados se usan para evaluación y nunca se suministran como respuestas al extractor o al motor.

## 10. Plan por fases y criterios de salida

### Fase 0 — Base del repositorio

Crear monorepo, aplicaciones, configuración estricta, Docker local, migraciones, CI y ADR de arquitectura. Documentar comandos y variables con ejemplos sin secretos. CI: instalación con lockfile, lint, tipos, pruebas y builds. Añadir reglas de contribución y límites entre capas.

Salida: un clon limpio arranca web, API, worker, PostgreSQL, Redis y almacenamiento S3 local de desarrollo; checks reproducibles en CI. Sin dependencias de una cuenta externa de pago para el recorrido básico.

### Fase 1 — Identidad y aislamiento

Integrar Better Auth, organizaciones, invitaciones y matriz de permisos; sesiones y auditoría de accesos relevantes. Probar específicamente integración Fastify y revocación de permisos.

Salida: dos empresas no pueden acceder a documentos, trabajos ni datos ajenos; una petición con identificador de otro tenant se rechaza.

### Fase 2 — Datos sintéticos y documentos

Investigar referencias públicas, generar expediente demo, definir contrato de importación y cargar documentos privados. Añadir estados de procesamiento y visualización de originales. Incorporar extracción real sobre PDF, sin sustituirla por resultados precargados ocultos.

Salida: cargar el expediente crea documentos y registros trazables; los errores y campos inciertos se muestran y pueden corregirse. Un extractor simulado solo se permite en pruebas, claramente identificado.

### Fase 3 — Comparación explicable

Implementar tarifas, condiciones, evidencias, reglas logísticas iniciales y análisis asíncrono. Cubrir caso de 62 USD y casos negativos. Implementar bandeja y detalle por partida con acceso al origen.

Salida: el motor produce los resultados esperados del dataset congelado y permite reproducir el análisis. La interfaz distingue confirmado, probable y no verificable.

### Fase 4 — Reclamos y seguimiento

Decisión humana, borrador editable, exportación/copia del correo y expediente de respaldo. Seguimiento con fechas y avisos internos; registrar envío solo cuando se confirme que ocurrió. No conectar el envío real todavía.

Salida: un usuario revisa, edita y exporta el reclamo del pickup con datos correctos; cada cambio queda auditado.

### Fase 5 — Despliegue y demostración

Desplegar API y workers separados, configurar almacenamiento privado, backups externos, logs con correlationId, métricas de jobs, límites de recursos y alertas. Ejecutar restauración de prueba y recorrido E2E en entorno desplegado.

Salida: demo utilizable, reinicios sin pérdida de decisiones, tareas recuperables y restauración documentada. Un servidor único no se presenta como alta disponibilidad.

### Fase 6 — Validación con empresa e integraciones reales

Obtener autorización y muestras permitidas, documentar CargoWise y sistema denominado Bravo Tran por el entrevistado, validar formatos/capacidades/costes. Implementar primero lectura y ejecutar en paralelo al proceso actual. Correo y CargoWise son conectores independientes.

Salida: demostrar calidad y ahorro de tiempo sobre documentos reales revisados por el experto antes de ampliar automatización. SSO corporativo según cliente. Escritura contable y envío de reclamos requieren alcance y autorización nuevos.

## 11. Interfaz y diseño

Diseño sobrio, legible y consistente con microapps Kershell. Pantallas iniciales: acceso, selector de organización, bandeja de facturas, carga documental, tarifas/vigencias, comparación con evidencia, reclamos e integraciones/configuración.

Priorizar el trabajo de revisión en escritorio con adaptación móvil. Una discrepancia debe explicar concepto, esperado, facturado, diferencia, motivo y evidencia en el mismo contexto. Estados con texto y no solo color, foco visible, navegación por teclado y componentes accesibles. Sin gráficos 3D decorativos en el flujo financiero.

## 12. Calidad y métricas

Pruebas de reglas para precisión decimal, condiciones, tarifas y duplicidad; integración para persistencia, permisos, outbox y reintentos; E2E para carga → revisión → reclamo. Probar archivos inválidos, fallos del proveedor IA y sincronización incompleta. No limitar verificación a que compile ni a comparar el resultado con datos inyectados.

Medir extracción por campo, discrepancias correctas/omitidas, falsas alertas, no verificables, correcciones humanas, duración de jobs, coste por documento y tiempo de revisión. Separar resultados sintéticos de resultados reales. Acordar objetivos numéricos tras medir línea base; no inventar garantías de precisión o velocidad.

## 13. Operación y pendientes

Usar entornos separados, HTTPS, base y Redis sin exposición pública, almacenamiento privado y secretos fuera del repositorio. Limitar archivos y recursos de parsing; revisar dependencias y minimizar datos en logs. Backups cifrados fuera del servidor y pruebas de restauración.

Pendientes: nombre definitivo, proveedor OCR/IA, proveedor S3, configuración de email transaccional, capacidad disponible del Hetzner y límites de concurrencia, plazos de retención, métodos de login iniciales y políticas de tarifas. No impiden iniciar las fases 0–2 con datos demo.

No estimar plazos cerrados hasta revisar capacidad de desarrollo y completar la prueba documental inicial. Ejecutar las fases en orden y revisar evidencia al cerrar cada una.

## 14. Primer paso al disponer del repositorio

Registrar el stack y los límites como ADR, crear la base ejecutable de fase 0 y preparar el dataset de fase 2. El primer hito funcional es el recorrido del pickup de 62 USD, no una colección de pantallas sin procesamiento real.

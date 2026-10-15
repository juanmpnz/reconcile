# Fase 3 — producto, dominio y motor financiero

Agente: `/root/analysis_product_domain`. Roles: product-manager, logistics-domain, backend-engineer. Modo: planificación y comprobación secuencial del propio código; **no revisión independiente**. Alcance: docs/product/explainable-analysis.md, packages/domain/src/analysis.ts y exportación, packages/sector-rules/.

Leídos AGENTS.md, .agents/WORKFLOW.md, perfiles de los tres roles, README, arquitectura, requisitos, plan, generador y extractor PDF existentes. La definición de aceptación se escribió antes del código y se compartió con principal/arquitectura/backend; tipos puros compartidos antes de contratos de transporte.

## Comportamiento

Motor puro `evaluateLogistics`, versión `logistics-v1`. Selección de acuerdo aceptado por proveedor, fecha y ámbito de la partida; exclusiones explícitas; identidad de pickup por operación, referencia, fecha y tramo, registro completado por proveedor distinto y factura del mismo servicio. Comparaciones decimales por partida, cantidades/unidades, consistencia aritmética e impuestos separados. No hay conversión monetaria, tolerancia global, aprobación contable ni carga de resultados esperados. Snapshot inmutable, resultado determinista.

Los PDFs iniciales respaldan automáticamente el pickup de 62 USD; la partida ocean handling no acredita explícitamente su puerto en la factura, por lo que exige revisión de ese dato antes de considerarse comparable. No se infiere su ámbito del pickup.

## Verificación ejecutada

- `node_modules/.bin/vitest run packages/sector-rules/src/logistics/evaluate.test.ts`: 23 casos pasados. Incluye positivo 62, tramos/referencias/fechas diferentes, identidades desconocidas, factura corroborante con referencia/fecha/proveedor/evidencia distintos, acuerdos ausentes/vencidos/estimados/no aceptados/superpuestos, ámbito diferente, fechas inválidas, moneda, errores compensados, precisión decimal incluido el producto de operandos de 30 enteros y 12 decimales, impuestos no nulos sin reglas fiscales, cantidad/unidad, impuestos y determinismo.
- `node_modules/.bin/tsc -p packages/domain/tsconfig.json` y `node_modules/.bin/tsc -p packages/sector-rules/tsconfig.json`: pasados.
- `node_modules/.bin/eslint packages/domain/src/analysis.ts packages/domain/src/index.ts packages/sector-rules --max-warnings 0`: pasado.

## Hallazgos y límites

- AR-A1, alto, arquitecto independiente: el ámbito de ocean handling podía ignorarse. Corregido: toda partida exige tramo/ámbito conocido coincidente; selección por ámbito antes de resolver superposición.
- AR-A2, medio, arquitecto independiente: cadenas vacías podían coincidir. Corregido con guardas de longitud y fechas calendario verificadas.
- Operación sin factura produce hallazgo con documentId nulo, conforme al contrato, sin UUID inventado.
- Revisiones, persistencia, API, extractor normalizado y UI pertenecen a otros agentes. No se certifican aquí HTTP, jobs, aislamiento, navegador ni CI. Arquitecto y QA realizan revisión independiente del motor y recorrido.
- Tarifas de tramos, créditos, reglas fiscales o cambiarias no contempladas exigen datos/reglas adicionales; no se implementa inferencia universal. Las fuentes sintéticas no reemplazan validación empresarial.

# Expediente sintético v1

Cuatro PDFs de entrada, sin identidades reales, generados con `generate.py` (Python + reportlab). Inspiración estructural y límites: `docs/product/demo-document-references.md`. Todos se identifican como demo y sin validez comercial.

Carga manual prevista en la organización: carrier-invoice y transport-invoice como factura; carrier-agreement como tarifa/acuerdo; pickup-record como registro operativo. `operational-data/pickup.json` documenta el contrato demo v1 propio para futura importación; no es un export oficial de CargoWise y esta entrega no afirma un importador JSON aún.

`expected-results/` es exclusivamente evaluación: no se incorpora a los bytes de entrada ni se consulta desde el producto/extractor. Fase2 extrae campos etiquetados reales y muestra faltantes: el registro operativo deliberadamente no tiene total. No incluye decisión automática sobre discrepancias: esa comparación pertenece a fase3.

No inferir reglas fiscales o precios del mercado a partir de estas muestras. El formato de extracción inicial es limitado y explícito; evaluar layouts de proveedores reales requiere autorización y muestras adicionales.

La muestra del acuerdo declara explícitamente la fecha de servicio como base de vigencia y las dimensiones comerciales sin restricción del escenario sintético. Así la comparación del demo no depende de tratar valores no extraídos como coincidencias. El generador y las pruebas usan el nombre canónico `carrier-agreement.pdf`. Estas condiciones son únicamente del demo, no una interpretación de contratos reales.

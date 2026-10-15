const warningReasons: Record<string, string> = {
  UNSUPPORTED_DOCUMENT_KIND:
    'Este tipo de documento no se usa en la comparación.',
  DOCUMENT_NOT_EXTRACTED:
    'La extracción no está disponible. Revisá el estado del documento antes de analizar.',
  EXTRACTION_UNSUPPORTED:
    'El texto extraído no permite obtener datos compatibles para la comparación.',
  DOCUMENT_FACTS_UNSUPPORTED:
    'El formato o los datos del documento no permiten construir partidas compatibles.',
};
export function warningMessage(
  warning: string,
  filenames: ReadonlyMap<string, string>,
) {
  const match =
    /^([A-Z_]+):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      warning,
    );
  const reason =
    match?.[1] && Object.hasOwn(warningReasons, match[1])
      ? warningReasons[match[1]]
      : undefined;
  if (!reason || !match?.[2])
    return 'Hay una limitación adicional en las fuentes. Revisá los documentos y sus datos antes de usar este resultado.';
  return `${filenames.get(match[2]) ?? 'Documento de este análisis'}: ${reason}`;
}
export function WarningsList({
  warnings,
  filenames,
  historical = false,
}: {
  warnings: string[];
  filenames: ReadonlyMap<string, string>;
  historical?: boolean;
}) {
  if (!warnings.length) return null;
  return (
    <div className="document-warning">
      <strong>
        {historical
          ? 'Limitaciones de los documentos de este análisis'
          : 'Documentos con limitaciones para comparar'}
      </strong>
      <ul>
        {warnings.map((warning, index) => (
          <li key={index}>{warningMessage(warning, filenames)}</li>
        ))}
      </ul>
      <p>El resultado no cubre los documentos o datos omitidos.</p>
    </div>
  );
}

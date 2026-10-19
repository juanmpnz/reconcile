import type {
  AnalysisDocumentInput,
  ExtractionResult,
} from '@reconcile/contracts';

type Evidence = AnalysisDocumentInput['evidence'][number];
type Line = AnalysisDocumentInput['lines'][number];

/** Decimal strings only; separators must follow an explicit, unambiguous format. */
export function commercialDecimal(raw: string): string | null {
  const text = raw.trim().replace(/−/g, '-');
  if (/^-?\d{1,18}(?:\.\d{1,8})?$/.test(text)) return text;
  if (/^-?(?:\d{1,3}(?:\.\d{3})+|\d{1,18}),\d{1,8}$/.test(text)) {
    const normalized = text.replace(/\./g, '').replace(',', '.');
    return /^-?\d{1,18}(?:\.\d{1,8})?$/.test(normalized) ? normalized : null;
  }
  return null;
}
const key = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const equipment = (value: string) =>
  value.replace(/[’']/g, '').replace(/\s+/g, '').toUpperCase();
const uncertain = (value: string) =>
  /lectura a confirmar|confirmar contra|uncertain|to be confirmed/i.test(value);

/** Header-bound adapter, not a universal table/OCR interpreter. */
export function commercialFacts(
  result: ExtractionResult,
  ev: (page: number, snippet: string) => Evidence,
) {
  const lines: Line[] = [];
  const warnings = new Set<string>();
  const exchangeRates: NonNullable<AnalysisDocumentInput['exchangeRates']> = [];
  const equipmentQuantities: NonNullable<
    AnalysisDocumentInput['equipmentQuantities']
  > = [];
  let origin: string | null = null,
    destination: string | null = null;
  let route: string | null = null;
  const routeCandidates = new Set<string>();
  let currentEquipment: string | null = null;
  const partial = () => warnings.add('COMMERCIAL_ROWS_PARTIAL');
  const add = (line: Omit<Line, 'id'>, reference = false) => {
    if (line.chargeKey === '') {
      partial();
      return;
    }
    if (line.description.length > 500 || (line.chargeKey?.length ?? 0) > 500) {
      partial();
      return;
    }
    if (reference) {
      const previous = lines.find(
        (item) =>
          item.chargeKey === line.chargeKey &&
          item.equipmentType === line.equipmentType &&
          item.currency === line.currency &&
          item.unitPrice === line.unitPrice &&
          item.billingBasis === line.billingBasis,
      );
      if (previous) {
        for (const evidence of line.evidence)
          if (
            previous.evidence.length < 20 &&
            !previous.evidence.some(
              (item) =>
                item.page === evidence.page &&
                item.snippet === evidence.snippet,
            )
          )
            previous.evidence.push(evidence);
        return;
      }
    }
    if (lines.length < 100)
      lines.push({ ...line, id: `commercial-${lines.length + 1}` });
    else {
      warnings.add('COMMERCIAL_TABLE_LIMIT');
      partial();
    }
  };
  for (const page of result.pages) {
    let invoiceCurrency: string | null = null;
    let matrix: string[] = [];
    for (const raw of page.text.split('\n')) {
      const text = raw.trim();
      if (/no se recibi[oó] la p[aá]gina|missing original page/i.test(text))
        warnings.add('SOURCE_INCOMPLETE');
      const routeMatch = text.match(
        /^DE:\s*(.+?)\s*\|\s*(?:VIA:\s*(.+?)\s*\|\s*)?A:\s*(.+)$/i,
      );
      const quoteRoute = text.match(
        /^From\s+(.+?)\s*\(Port\)\s+to\s+(.+?)\s*\(Port\)$/i,
      );
      if (routeMatch?.[1] && routeMatch[3]) {
        origin = routeMatch[1].trim();
        destination = routeMatch[3].trim();
        route = [origin, routeMatch[2]?.trim(), destination]
          .filter(Boolean)
          .join(' → ');
      } else if (quoteRoute?.[1] && quoteRoute[2]) {
        origin = quoteRoute[1].trim();
        destination = quoteRoute[2].trim();
        route = `${origin} → ${destination}`;
      }
      if (routeMatch || quoteRoute)
        routeCandidates.add(JSON.stringify([origin, destination, route]));
      if (/^\d+\s+CONT\./i.test(text)) {
        currentEquipment = null;
        invoiceCurrency = null;
      }
      const group = text.match(
        /^(\d+)\s+CONT\.\s*(20|40)[’']\s*X\s*.*?(HIGH CUBE|GENERAL PURPOSE|STANDARD|STD)\s+CONT\./i,
      );
      if (group?.[1] && group[2] && group[3]) {
        const count = group[1].replace(/^0+(?=\d)/, '');
        currentEquipment =
          group[2] + (/HIGH CUBE/i.test(group[3]) ? 'HC' : 'STD');
        if (equipmentQuantities.length < 50 && /^\d{1,18}$/.test(count))
          equipmentQuantities.push({
            equipment: currentEquipment,
            quantity: count,
            evidence: [ev(page.page, text)],
          });
        else partial();
        invoiceCurrency = null;
      }
      const header = text.match(
        /^Concepto original\s+Precio tarifa\s+Divisa\s+Qty\s+Ud\.\s+Importe\s+([A-Z]{3})\s+IVA$/i,
      );
      if (header?.[1]) {
        invoiceCurrency = header[1].toUpperCase();
        matrix = [];
        continue;
      }
      const matrixHeader = text.match(
        /^(?:Freight Charges|Surcharge\s*\/\s*Concept)\s+Curr\s+(.+)$/i,
      );
      if (matrixHeader?.[1]) {
        matrix = matrixHeader[1].split(/\s+/).map(equipment);
        if (
          matrix.length > 3 ||
          !matrix.every((v) => /^(20|40)(STD|HC)$/.test(v)) ||
          new Set(matrix).size !== matrix.length
        ) {
          matrix = [];
          partial();
        }
        invoiceCurrency = null;
        continue;
      }
      if (invoiceCurrency) {
        const row = text.match(
          /^(.+?)\s+(-?[\d.,]+)\s+([A-Z]{3})\s+([\d.,]+)\s+(CTR|BIL|BL|SHIPMENT)\s+(-?[\d.,]+)\s+([A-Z0-9]+)$/,
        );
        if (row?.[1] && row[3] && row[5]) {
          const unitPrice = commercialDecimal(row[2] ?? ''),
            quantity = commercialDecimal(row[4] ?? ''),
            amount = commercialDecimal(row[6] ?? '');
          if (unitPrice !== null && quantity !== null && amount !== null)
            add({
              description: row[1],
              chargeKey: key(row[1]),
              service: 'unknown',
              route: null,
              quantity,
              unit: row[5],
              billingBasis:
                row[5] === 'CTR'
                  ? 'container'
                  : row[5] === 'SHIPMENT'
                    ? 'shipment'
                    : 'bl',
              equipmentType: row[5] === 'CTR' ? currentEquipment : null,
              unitPrice: row[3] === invoiceCurrency ? unitPrice : null,
              tariffUnitPrice: unitPrice,
              tariffCurrency: row[3],
              amount,
              currency: invoiceCurrency,
              evidence: [ev(page.page, text)],
            });
          else warnings.add('COMMERCIAL_ROWS_PARTIAL');
          continue;
        }
      }
      if (invoiceCurrency && text) {
        if (/\s(?:CTR|BIL|BL|SHIPMENT)\s/.test(text)) partial();
        else invoiceCurrency = null;
      }
      if (
        /^(?:Subject to|The Lumpsum includes|Seafreight|Equipo\s+Curr|SUMMARY|NETO|BRUTO|CAMBIO|Importes|Conditions|Terms|Contact|Transcripci[oó]n|Campos normalizados)/i.test(
          text,
        )
      ) {
        matrix = [];
        invoiceCurrency = null;
      }
      if (matrix.length) {
        const row = text.match(/^(.+?)\s+([A-Z]{3})\s+(.+)$/);
        if (row?.[1] && row[2] && row[3]) {
          const cells = row[3].trim().split(/\s+/);
          const prices = cells.map(commercialDecimal);
          if (cells.length === matrix.length && prices.every((v) => v !== null))
            matrix.forEach((type, index) =>
              add(
                {
                  description: row[1] ?? '',
                  chargeKey: key(row[1] ?? ''),
                  service: 'unknown',
                  route: null,
                  quantity: null,
                  unit: 'container',
                  billingBasis: 'container',
                  equipmentType: type,
                  unitPrice: prices[index] ?? null,
                  tariffUnitPrice: prices[index] ?? null,
                  tariffCurrency: row[2] ?? null,
                  amount: null,
                  currency: row[2] ?? null,
                  evidence: [ev(page.page, text)],
                },
                true,
              ),
            );
          else partial();
          continue;
        }
        if (text && !/^(?:Export|Freight|Import) Surcharges$/i.test(text))
          matrix = [];
      }
      const perBl = text.match(
        /^Subject to\s+([^:]+):\s*([A-Z]{3})\s+(-?[\d.,]+)\s+per Bill of Lading(?:\s+(.+))?$/i,
      );
      if (perBl?.[1] && perBl[2]) {
        const price = uncertain(text)
          ? null
          : commercialDecimal(perBl[3] ?? '');
        if (uncertain(text)) warnings.add('UNCERTAIN_CHARGE_REQUIRES_REVIEW');
        add(
          {
            description: perBl[1],
            chargeKey: key(perBl[1]),
            service: 'unknown',
            route: null,
            quantity: null,
            unit: 'bl',
            billingBasis: 'bl',
            equipmentType: null,
            unitPrice: price,
            tariffUnitPrice: price,
            tariffCurrency: perBl[2],
            amount: null,
            currency: perBl[2],
            evidence: [ev(page.page, text)],
          },
          true,
        );
      }
      if (/Lumpsum includes/i.test(text))
        warnings.add('INCLUSIONS_REQUIRE_REVIEW');
      const fx = text.match(/^1\s+([A-Z]{3})\s*=\s*([\d.,]+)\s+([A-Z]{3})$/);
      if (fx?.[1] && fx[3]) {
        const rate = commercialDecimal(fx[2] ?? '');
        if (rate && !/^0(?:\.0+)?$/.test(rate) && exchangeRates.length < 50)
          exchangeRates.push({
            from: fx[1],
            to: fx[3],
            rate,
            evidence: [ev(page.page, text)],
          });
        else partial();
      }
    }
  }
  if (routeCandidates.size > 1) {
    origin = null;
    destination = null;
    route = null;
    warnings.add('AMBIGUOUS_SCOPE');
  }
  if (lines.length) warnings.add('HEADER_BASED_COMMERCIAL_EXTRACTION');
  return {
    lines,
    warnings: [...warnings],
    exchangeRates,
    equipmentQuantities,
    origin: origin && origin.length <= 500 ? origin : null,
    destination: destination && destination.length <= 500 ? destination : null,
    route: route && route.length <= 500 ? route : null,
  };
}

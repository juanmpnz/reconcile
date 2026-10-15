import { describe, expect, it } from 'vitest';
import { warningMessage } from './warnings';
const id = '00000000-0000-4000-8000-000000000001';
describe('analysis source limitation messages', () => {
  it('identifies the available source with a human reason for every supported warning', () => {
    const filenames = new Map([[id, 'acuerdo.pdf']]);
    for (const code of [
      'UNSUPPORTED_DOCUMENT_KIND',
      'DOCUMENT_NOT_EXTRACTED',
      'EXTRACTION_UNSUPPORTED',
      'DOCUMENT_FACTS_UNSUPPORTED',
    ]) {
      const message = warningMessage(`${code}:${id}`, filenames);
      expect(message).toContain('acuerdo.pdf:');
      expect(message).not.toContain(code);
      expect(message).not.toContain(id);
    }
  });
  it('keeps historical unavailable sources and unknown warnings free of internal identifiers', () => {
    expect(warningMessage(`DOCUMENT_NOT_EXTRACTED:${id}`, new Map())).toContain(
      'Documento de este análisis:',
    );
    for (const warning of [
      `UNKNOWN:${id}`,
      'raw-private-content',
      'EXTRACTION_UNSUPPORTED:not-an-id',
    ]) {
      const message = warningMessage(warning, new Map());
      expect(message).not.toContain(warning);
      expect(message).not.toContain(id);
      expect(message).toContain('limitación adicional');
    }
  });
});

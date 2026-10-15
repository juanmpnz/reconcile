import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { extractPdf } from './extract.js';
describe('production PDF adapter in the test module runner', () => {
  it('extracts real synthetic PDF bytes and source evidence', async () => {
    const bytes = readFileSync(
      new URL(
        '../../../fixtures/logistics/source-documents/carrier-invoice.pdf',
        import.meta.url,
      ),
    );
    const result = await extractPdf(bytes);
    expect(result.pages[0]?.text).toContain('\n');
    expect(result.pages[0]?.text).not.toContain('\\n');
    expect(result.fields.find((field) => field.name === 'total')).toMatchObject(
      { value: '212.00', status: 'extracted', evidence: { page: 1 } },
    );
  });
  it('reports malformed PDF as a parser error rather than a transport failure', async () => {
    await expect(
      extractPdf(Buffer.from('%PDF-1.7\nnot a valid PDF')),
    ).rejects.toMatchObject({ code: 'PDF_INVALID' });
  });
});

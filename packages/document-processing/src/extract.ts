import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  extractionResultSchema,
  type ExtractionResult,
  type ExtractionFieldName,
} from '@reconcile/contracts';
const pageSchema = extractionResultSchema.shape.pages;
export class ExtractionError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
// The worker only receives bytes and a fixed installed module URL. No fixture/expected results.
const parserSource = `const {parentPort,workerData}=require('node:worker_threads');
(async()=>{const {getDocument}=await import(workerData.moduleUrl);const task=getDocument({data:new Uint8Array(workerData.bytes),isEvalSupported:false,useWorkerFetch:false,disableFontFace:true,useSystemFonts:false,useWasm:false,enableXfa:false,stopAtErrors:true,verbosity:0});const doc=await task.promise;try{if(doc.numPages>50)throw Error('PDF_PAGE_LIMIT');let count=0;const pages=[];for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const content=await page.getTextContent();let text='';for(const item of content.items){if(typeof item.str==='string')text+=item.str+(item.hasEOL?'\\n':' ');}count+=text.length;if(count>200000)throw Error('PDF_TEXT_LIMIT');pages.push({page:n,text});page.cleanup();}parentPort.postMessage({pages});}finally{await doc.destroy();}})().catch(e=>parentPort.postMessage({error:e?.name==='PasswordException'?'PDF_ENCRYPTED':(['PDF_PAGE_LIMIT','PDF_TEXT_LIMIT'].includes(e?.message)?e.message:'PDF_INVALID')}));`;
const labels: Record<ExtractionFieldName, string> = {
  provider: 'Provider|Proveedor',
  documentNumber:
    'Document number|Invoice number|Número de documento|Numero de documento|Factura',
  operationReference:
    'Operation reference|Referencia de operación|Referencia de operacion',
  date: 'Date|Fecha',
  currency: 'Currency|Moneda',
  total: 'Total',
};
export async function extractPdf(bytes: Uint8Array): Promise<ExtractionResult> {
  const pages = await new Promise<unknown>((resolve, reject) => {
    const thread = new Worker(parserSource, {
      eval: true,
      env: {},
      execArgv: [],
      workerData: {
        bytes,
        moduleUrl: pathToFileURL(
          createRequire(import.meta.url).resolve(
            'pdfjs-dist/legacy/build/pdf.mjs',
          ),
        ).href,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 16,
      },
      stdout: true,
      stderr: true,
    });
    thread.stdout?.resume();
    thread.stderr?.resume();
    const timer = setTimeout(() => {
      void thread.terminate();
      reject(new ExtractionError('PDF_TIMEOUT'));
    }, 10000);
    thread.once('message', (value: unknown) => {
      clearTimeout(timer);
      void thread.terminate();
      resolve(value);
    });
    thread.once('error', () => {
      clearTimeout(timer);
      reject(new ExtractionError('PDF_RESOURCE_LIMIT'));
    });
    thread.once('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new ExtractionError('PDF_RESOURCE_LIMIT'));
      }
    });
  });
  if (!pages || typeof pages !== 'object')
    throw new ExtractionError('PDF_INVALID');
  const error: unknown = Reflect.get(pages, 'error');
  if (typeof error === 'string') throw new ExtractionError(error);
  const parsed = pageSchema.parse(Reflect.get(pages, 'pages'));
  const fields = Object.entries(labels).map(([field, label]) => {
    const name = field as ExtractionFieldName;
    const matches: { value: string; page: number; snippet: string }[] = [];
    for (const page of parsed) {
      const regex = new RegExp(
        '(?:^|\\n|\\s{2,})(?:' + label + ')\\s*:\\s*([^\\n]+)',
        'gim',
      );
      for (const match of page.text.matchAll(regex)) {
        const value = match[1]?.trim();
        if (value)
          matches.push({
            value: value.slice(0, 500),
            page: page.page,
            snippet: match[0].trim().slice(0, 500),
          });
      }
    }
    const unique = [...new Set(matches.map((m) => m.value))];
    const first = matches[0];
    return {
      name,
      value: unique.length === 1 && first ? first.value : null,
      evidence:
        unique.length === 1 && first
          ? { page: first.page, snippet: first.snippet }
          : null,
      status:
        unique.length === 0
          ? ('missing' as const)
          : unique.length === 1
            ? ('extracted' as const)
            : ('ambiguous' as const),
    };
  });
  const warnings: string[] = [
    'HUMAN_REVIEW_REQUIRED',
    'LABEL_BASED_EXTRACTION',
  ];
  if (parsed.every((p) => p.text.trim().length === 0))
    warnings.push('OCR_UNSUPPORTED');
  return extractionResultSchema.parse({
    engine: 'pdfjs-text-v1',
    pages: parsed,
    fields,
    warnings,
  });
}

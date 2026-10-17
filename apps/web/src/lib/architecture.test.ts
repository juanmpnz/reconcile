import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const eslint = new ESLint({ cwd: root });
async function architectureErrors(code: string, filePath: string) {
  const results = await eslint.lintText(code, { filePath });
  return results
    .flatMap((result) => result.messages)
    .filter(
      (message) =>
        message.ruleId === 'no-restricted-syntax' ||
        message.ruleId === 'no-restricted-imports',
    );
}

describe('enforced frontend architecture', () => {
  it('rejects direct native controls throughout production screens but allows semantic layout and DS composition', async () => {
    for (const tag of [
      'button',
      'input',
      'textarea',
      'select',
      'label',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'dialog',
      'details',
      'summary',
      'progress',
      'meter',
    ]) {
      expect(
        await architectureErrors(
          `export const View = () => <${tag} />;`,
          'apps/web/src/features/example/view.tsx',
        ),
      ).toHaveLength(1);
    }
    expect(
      await architectureErrors(
        'export const View = () => <main><section><h1>Title</h1><Button /><Input /><Select><option value="a">A</option></Select></section></main>;',
        'apps/web/src/features/example/view.tsx',
      ),
    ).toHaveLength(0);
    expect(
      await architectureErrors(
        'export const Input = () => <input />;',
        'apps/web/src/design-system/example.tsx',
      ),
    ).toHaveLength(0);
  });
  it('rejects fetch bypasses in both API modules and TSX while permitting the single transport and SDK', async () => {
    for (const filePath of [
      'apps/web/src/features/example/api.ts',
      'apps/web/src/features/example/view.tsx',
      'apps/web/src/design-system/example.tsx',
    ]) {
      for (const call of [
        'fetch("/api/private")',
        'window.fetch("/api/private")',
        'globalThis.fetch("/api/private")',
        'window["fetch"]("/api/private")',
      ]) {
        expect(
          await architectureErrors(
            `export const run = () => ${call};`,
            filePath,
          ),
        ).toHaveLength(1);
      }
    }
    expect(
      await architectureErrors(
        'export const run = () => fetch("/api/private");',
        'apps/web/src/lib/http.ts',
      ),
    ).toHaveLength(0);
    expect(
      await architectureErrors(
        'export const run = () => authClient.organization.list();',
        'apps/web/src/features/example/api.ts',
      ),
    ).toHaveLength(0);
  });
  it('rejects legacy UI imports without blocking maintained DS imports or compatibility re-exports', async () => {
    expect(
      await architectureErrors(
        'import { Button } from "../../components/ui/primitives"; export { Button };',
        'apps/web/src/features/example/view.tsx',
      ),
    ).toHaveLength(1);
    expect(
      await architectureErrors(
        'export { Button } from "@/components/ui/primitives";',
        'apps/web/src/app/example.ts',
      ),
    ).toHaveLength(1);
    expect(
      await architectureErrors(
        'export { Button } from "../../design-system/primitives";',
        'apps/web/src/features/example/view.tsx',
      ),
    ).toHaveLength(0);
    expect(
      await architectureErrors(
        'export { Button } from "../../design-system/primitives";',
        'apps/web/src/components/ui/example.tsx',
      ),
    ).toHaveLength(0);
  });
});

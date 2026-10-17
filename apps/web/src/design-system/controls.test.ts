import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Checkbox, FileInput, Input, Textarea } from './controls';
import { Field, Button } from './primitives';
import { Table, TableBody, TableCell, TableRow } from './table';

describe('design system native form and evidence semantics', () => {
  it('preserves decimal strings, form association and readonly data', () => {
    const html = renderToStaticMarkup(
      h(Input, {
        name: 'amount',
        form: 'draft',
        value: '9007199254740993.01',
        readOnly: true,
        'aria-describedby': 'amount-help',
      }),
    );
    expect(html).toContain('value="9007199254740993.01"');
    expect(html).toContain('form="draft"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('aria-describedby="amount-help"');
    expect(
      renderToStaticMarkup(
        h(Textarea, {
          name: 'original',
          defaultValue: 'Texto original',
          readOnly: true,
        }),
      ),
    ).toContain('Texto original');
  });
  it('keeps an optional field optional and links errors and hints to its supplied id', () => {
    const html = renderToStaticMarkup(
      h(Field, {
        name: 'reference',
        label: 'Referencia',
        id: 'reference',
        required: false,
        hint: 'Opcional',
        error: 'Revisá el dato',
      }),
    );
    expect(html).not.toContain('required=""');
    expect(html).toContain('for="reference"');
    expect(html).toContain('aria-describedby="reference-hint reference-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(
      renderToStaticMarkup(h(Field, { name: 'name', label: 'Nombre' })),
    ).toContain('required=""');
  });
  it('preserves upload restrictions, checkbox validation and pending submit behavior', () => {
    expect(
      renderToStaticMarkup(
        h(FileInput, { name: 'pdf', accept: '.pdf', required: true }),
      ),
    ).toContain('type="file"');
    expect(
      renderToStaticMarkup(h(Checkbox, { name: 'confirm', required: true })),
    ).toContain('type="checkbox"');
    const html = renderToStaticMarkup(
      h(Button, { type: 'submit', pending: true }, 'Guardar'),
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });
  it('keeps contextual financial evidence semantic and lossless', () => {
    const html = renderToStaticMarkup(
      h(
        Table,
        null,
        h(
          TableBody,
          null,
          h(TableRow, null, h(TableCell, null, '9007199254740993.01')),
        ),
      ),
    );
    expect(html).toBe(
      '<table><tbody><tr><td>9007199254740993.01</td></tr></tbody></table>',
    );
  });
});

import { createElement as h, Fragment, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { splitPanelForm } from './side-panel';
import { FormActions } from './layout';
import { Button } from './primitives';
function NullFeedback() {
  return null;
}
describe('SidePanel single scroll body and semantic form', () => {
  it('keeps null feedback siblings and long form within one scroll area with a fixed form footer', () => {
    const submit = vi.fn();
    const children = h(
      Fragment,
      null,
      h(NullFeedback, { key: 'feedback' }),
      h(
        'form',
        { onSubmit: submit, key: 'form' },
        h(
          'label',
          { key: 'field' },
          'Nombre',
          h('input', { name: 'name', key: 'input' }),
        ),
        h(
          'div',
          { className: 'dialog-actions', key: 'actions' },
          h('button', { type: 'button', key: 'cancel' }, 'Cancelar'),
          h('button', { type: 'submit', key: 'submit' }, 'Guardar'),
        ),
      ),
      h('p', { key: 'information' }, 'Información de respaldo'),
    );
    const panel = splitPanelForm(children, vi.fn());
    expect(
      isValidElement<{ onSubmit: typeof submit }>(panel) &&
        panel.props.onSubmit,
    ).toBe(submit);
    const html = renderToStaticMarkup(panel);
    expect(html.startsWith('<form')).toBe(true);
    expect(html.endsWith('</form>')).toBe(true);
    expect(html.match(/class="side-panel-scroll"/g)).toHaveLength(1);
    expect(html.match(/class="side-panel-footer"/g)).toHaveLength(1);
    expect(html.indexOf('Información de respaldo')).toBeLessThan(
      html.indexOf('side-panel-footer'),
    );
    expect(html).toContain('type="submit"');
  });
  it('recognizes DS actions without requiring a consumer CSS class', () => {
    const html = renderToStaticMarkup(
      splitPanelForm(
        h(
          'form',
          null,
          h('p', { key: 'body' }, 'Contenido'),
          h(
            FormActions,
            { key: 'actions' },
            h(Button, { type: 'button', key: 'cancel' }, 'Cancelar'),
            h(Button, { type: 'submit', key: 'save' }, 'Guardar'),
          ),
        ),
        vi.fn(),
      ),
    );
    expect(html).toContain('side-panel-footer');
    expect(html.indexOf('Contenido')).toBeLessThan(
      html.indexOf('side-panel-footer'),
    );
    expect(html).toContain('type="submit"');
  });
  it('uses one scroll area without inventing a form when no form is provided', () => {
    const html = renderToStaticMarkup(
      splitPanelForm(
        h(Fragment, null, h('p', null, 'Uno'), h('p', null, 'Dos')),
        vi.fn(),
      ),
    );
    expect(html.match(/class="side-panel-scroll"/g)).toHaveLength(1);
    expect(html).not.toContain('<form');
  });
});

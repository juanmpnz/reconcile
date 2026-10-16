import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useRef,
} from 'react';
import type { ComponentProps, ReactNode } from 'react';
import * as Primitive from '@radix-ui/react-dialog';
import { Button } from './primitives';
type NodeProps = {
  children?: ReactNode;
  className?: string;
  onClick?: ComponentProps<'button'>['onClick'];
  type?: string;
};
export function splitPanelForm(children: ReactNode, onCancel: () => void) {
  return Children.map(children, (node) => {
    if (!isValidElement<NodeProps>(node) || node.type !== 'form')
      return <div className="side-panel-scroll">{node}</div>;
    const body: ReactNode[] = [];
    const actions: ReactNode[] = [];
    Children.forEach(node.props.children, (child) => {
      if (
        isValidElement<NodeProps>(child) &&
        child.props.className?.split(' ').includes('dialog-actions')
      )
        actions.push(
          cloneElement(
            child,
            {},
            Children.map(child.props.children, (action) => {
              if (
                isValidElement<NodeProps>(action) &&
                action.props.type === 'button' &&
                action.props.children === 'Cancelar'
              )
                return cloneElement(action, {
                  onClick: (event) => {
                    event.preventDefault();
                    onCancel();
                  },
                });
              return action;
            }),
          ),
        );
      else body.push(child);
    });
    return cloneElement(
      node,
      { className: `${node.props.className ?? ''} side-panel-form` },
      <>
        <div className="side-panel-scroll">{Children.toArray(body)}</div>
        {actions.length > 0 && (
          <footer className="side-panel-footer">
            {Children.toArray(actions)}
          </footer>
        )}
      </>,
    );
  });
}
export function SidePanel({
  title,
  description,
  trigger,
  open,
  onOpenChange,
  children,
  busy = false,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  function keepEditing() {
    setDiscard(false);
    window.requestAnimationFrame(() => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    });
  }
  function request(next: boolean) {
    if (busy) return;
    if (next) {
      setDirty(false);
      setDiscard(false);
      onOpenChange(true);
    } else if (dirty) {
      if (!discard)
        previousFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      setDiscard(true);
      window.requestAnimationFrame(() => keepRef.current?.focus());
    } else onOpenChange(false);
  }
  const content = splitPanelForm(children, () => request(false));
  return (
    <Primitive.Root open={open} onOpenChange={request}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className="dialog-overlay" />
        <Primitive.Content
          className="side-panel"
          onChangeCapture={() => setDirty(true)}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            request(false);
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            request(false);
          }}
        >
          <header className="side-panel-header">
            <div>
              <Primitive.Title className="dialog-title">
                {title}
              </Primitive.Title>
              <Primitive.Description className="dialog-description">
                {description}
              </Primitive.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              aria-label="Cerrar panel"
              onClick={() => request(false)}
            >
              ×
            </Button>
          </header>
          {discard && (
            <div className="side-panel-discard" role="alert">
              <strong>Hay cambios sin guardar.</strong>
              <p>¿Querés conservar la edición o descartar los cambios?</p>
              <div>
                <Button ref={keepRef} variant="outline" onClick={keepEditing}>
                  Conservar edición
                </Button>
                <Button
                  onClick={() => {
                    setDirty(false);
                    setDiscard(false);
                    onOpenChange(false);
                  }}
                >
                  Descartar cambios
                </Button>
              </div>
            </div>
          )}
          <div className="side-panel-main">{content}</div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

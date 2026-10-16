import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import * as Primitive from '@radix-ui/react-select';
import './select.css';
type OptionProps = {
  value?: string | number;
  children?: ReactNode;
  disabled?: boolean;
};
function optionsFrom(children: ReactNode): OptionProps[] {
  return Children.toArray(children).flatMap((node) => {
    if (!isValidElement<OptionProps>(node)) return [];
    if (node.type === Fragment) return optionsFrom(node.props.children);
    return node.type === 'option' ? [node.props] : [];
  });
}
type Props = {
  children: ReactNode;
  id?: string;
  name?: string;
  form?: string;
  value?: string | number | undefined;
  defaultValue?: string | number | undefined;
  onValueChange?: (value: string) => void;
  disabled?: boolean | undefined;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  title?: string;
};
// Native option nodes are declarative data only; every visible option is rendered by Radix.
export function Select({
  children,
  id,
  name,
  form,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
  className = '',
  ...aria
}: Props) {
  const options = optionsFrom(children);
  const [internal, setInternal] = useState(() =>
    String(defaultValue ?? options[0]?.value ?? ''),
  );
  const [invalid, setInvalid] = useState(false);
  const generated = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const raw = value === undefined ? internal : String(value);
  let empty = `__reconcile_empty_${generated}`;
  while (options.some((option) => String(option.value ?? '') === empty))
    empty += '__';
  const emptyLabel =
    options.find((option) => String(option.value ?? '') === '')?.children ??
    'Seleccioná una opción';
  return (
    <div
      className={`select-field ${className}`}
      onInvalidCapture={(event) => {
        event.preventDefault();
        setInvalid(true);
        trigger.current?.focus();
      }}
    >
      <Primitive.Root
        {...(name ? { name } : {})}
        {...(form ? { form } : {})}
        value={raw}
        disabled={disabled}
        required={required}
        onValueChange={(selected) => {
          const next = selected === empty ? '' : selected;
          if (value === undefined) setInternal(next);
          setInvalid(false);
          onValueChange?.(next);
        }}
      >
        <Primitive.Trigger
          {...aria}
          id={id}
          ref={trigger}
          className="select-trigger"
          aria-invalid={invalid || undefined}
          aria-describedby={
            [aria['aria-describedby'], invalid ? `${generated}-error` : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        >
          <Primitive.Value placeholder={emptyLabel} />
          <Primitive.Icon aria-hidden="true" className="select-chevron">
            ⌄
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            className="select-content"
            position="popper"
            sideOffset={5}
            collisionPadding={8}
          >
            <Primitive.ScrollUpButton
              className="select-scroll"
              aria-label="Más opciones arriba"
            >
              ⌃
            </Primitive.ScrollUpButton>
            <Primitive.Viewport className="select-viewport">
              {options.map((option, index) => {
                const optionValue = String(option.value ?? '');
                return (
                  <Primitive.Item
                    key={`${optionValue}:${index}`}
                    value={optionValue || empty}
                    disabled={Boolean(option.disabled)}
                    className="select-option"
                    data-value={optionValue}
                  >
                    <Primitive.ItemText>{option.children}</Primitive.ItemText>
                    <Primitive.ItemIndicator
                      className="select-check"
                      aria-hidden="true"
                    >
                      ✓
                    </Primitive.ItemIndicator>
                  </Primitive.Item>
                );
              })}
            </Primitive.Viewport>
            <Primitive.ScrollDownButton
              className="select-scroll"
              aria-label="Más opciones abajo"
            >
              ⌄
            </Primitive.ScrollDownButton>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
      {invalid && (
        <small className="select-error" id={`${generated}-error`}>
          Elegí una opción para continuar.
        </small>
      )}
    </div>
  );
}

import { componentClasses } from './classes';
import type { ComponentProps } from 'react';

/** Native form semantics, refs and validation remain available through every control. */
export function Input(props: ComponentProps<'input'>) {
  return <input {...props} />;
}
export function Textarea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} />;
}
export function Checkbox({
  className = '',
  ...props
}: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <Input
      {...props}
      className={componentClasses('ds-checkbox', className)}
      type="checkbox"
    />
  );
}
export function FileInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  return <Input {...props} type="file" />;
}
export function Label(props: ComponentProps<'label'>) {
  return <label {...props} />;
}
export function FormField({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={componentClasses('field', className)} />;
}

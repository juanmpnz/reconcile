import { componentClasses } from './classes';
import type { ComponentProps } from 'react';
export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return <section {...props} className={componentClasses('card', className)} />;
}
export function PageHeader({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div {...props} className={componentClasses('page-header', className)} />
  );
}
export function FormActions({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return (
    <div {...props} className={componentClasses('dialog-actions', className)} />
  );
}
export function Accordion(props: ComponentProps<'details'>) {
  return <details {...props} />;
}
export function AccordionTrigger(props: ComponentProps<'summary'>) {
  return <summary {...props} />;
}

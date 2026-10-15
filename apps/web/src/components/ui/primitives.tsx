import { useEffect, useId, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from './loading';
export function Button({
  variant = 'default',
  className = '',
  pending = false,
  children,
  disabled,
  ...props
}: ComponentProps<'button'> & {
  variant?: 'default' | 'outline' | 'ghost';
  pending?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`button button-${variant} ${className}`}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
export function Field({
  name,
  label,
  hint,
  ...props
}: ComponentProps<'input'> & {
  name: string;
  label: string;
  hint?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        name={name}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Feedback({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message && error) ref.current?.focus();
  }, [message, error]);
  return message ? (
    <div
      ref={ref}
      tabIndex={-1}
      className="feedback"
      role={error ? 'alert' : 'status'}
    >
      <strong>{error ? 'No se pudo completar la acción. ' : ''}</strong>
      {message}
    </div>
  ) : null;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function TableRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-region" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function RequestError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="request-error">
      <Feedback
        error
        message={
          error instanceof Error
            ? error.message
            : 'El servicio no está disponible. Volvé a intentar.'
        }
      />
      <Button variant="outline" onClick={retry}>
        Reintentar
      </Button>
    </div>
  );
}

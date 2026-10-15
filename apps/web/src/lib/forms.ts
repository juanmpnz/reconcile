export function value(form: HTMLFormElement, name: string) {
  const item = new FormData(form).get(name);
  return typeof item === 'string' ? item.trim() : '';
}
export function password(form: HTMLFormElement) {
  const item = new FormData(form).get('password');
  return typeof item === 'string' ? item : '';
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No pudimos completar la solicitud. Volvé a intentar.';
}

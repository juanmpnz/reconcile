export const AUTH_CHANGED_EVENT = 'reconcile:authentication-changed';
export function authenticationChanged() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

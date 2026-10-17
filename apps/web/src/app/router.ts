import { useLocation } from 'react-router';
type NavigationState = {
  notice: 'organization-created' | 'invitation-accepted';
} | null;
type Navigator = (
  path: string,
  options: { replace: boolean; state: NavigationState },
) => void | Promise<void>;
let navigator: Navigator | undefined;
export function configureNavigation(next: Navigator) {
  navigator = next;
}
export function internalDestination(path: string | null, fallback = '/') {
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\\\r\n]/.test(path)
  )
    return fallback;
  const url = new URL(path, 'https://reconcile.invalid');
  if (
    url.origin !== 'https://reconcile.invalid' ||
    ['/login', '/two-factor', '/security'].includes(url.pathname)
  )
    return fallback;
  return url.pathname + url.search + url.hash;
}
export function useRoute() {
  const location = useLocation();
  return new URL(
    location.pathname + location.search + location.hash,
    window.location.origin,
  );
}
export function navigate(
  path: string,
  replace = false,
  state: NavigationState = null,
) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path))
    throw new Error('Invalid internal navigation');
  if (!navigator) throw new Error('Application router is not initialized');
  void navigator(path, { replace, state });
}
export function callback(path: string) {
  return new URL(internalDestination(path), window.location.origin).href;
}
export function organizationPath(id: string, tab = 'overview', page = 0) {
  const query = new URLSearchParams({ tab });
  if (page > 0) query.set('page', String(page));
  return `/organizations/${encodeURIComponent(id)}?${query}`;
}
export function navigationNotice() {
  const state: unknown = window.history.state?.usr;
  if (!state || typeof state !== 'object' || !('notice' in state)) return '';
  return state.notice === 'organization-created'
    ? 'Organización creada.'
    : state.notice === 'invitation-accepted'
      ? 'Invitación aceptada.'
      : '';
}

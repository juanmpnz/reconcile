import { useSyncExternalStore } from 'react';
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}
function snapshot() {
  return window.location.pathname + window.location.search;
}
export function useRoute() {
  const route = useSyncExternalStore(subscribe, snapshot);
  return new URL(route, window.location.origin);
}
export function navigate(
  path: string,
  replace = false,
  state: {
    notice: 'organization-created' | 'invitation-accepted';
  } | null = null,
) {
  if (replace) window.history.replaceState(state, '', path);
  else window.history.pushState(state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function callback(path: string) {
  return new URL(path, window.location.origin).href;
}
export function organizationPath(id: string, tab = 'overview', page = 0) {
  const query = new URLSearchParams({ tab });
  if (page > 0) query.set('page', String(page));
  return `/organizations/${encodeURIComponent(id)}?${query}`;
}

export function navigationNotice() {
  const state: unknown = window.history.state;
  if (!state || typeof state !== 'object' || !('notice' in state)) return '';
  if (state.notice === 'organization-created') return 'Organización creada.';
  if (state.notice === 'invitation-accepted') return 'Invitación aceptada.';
  return '';
}

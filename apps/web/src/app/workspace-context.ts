export function rememberedOrganization(userId: string) {
  try {
    return window.localStorage.getItem(`reconcile:workspace:${userId}`);
  } catch {
    return null;
  }
}
export function rememberOrganization(userId: string, organizationId: string) {
  try {
    window.localStorage.setItem(
      `reconcile:workspace:${userId}`,
      organizationId,
    );
  } catch {
    /* Storage is only a navigation hint. */
  }
}
export function forgetOrganization(userId: string, organizationId?: string) {
  try {
    if (!organizationId || rememberedOrganization(userId) === organizationId)
      window.localStorage.removeItem(`reconcile:workspace:${userId}`);
  } catch {
    /* Authorization never depends on storage. */
  }
}

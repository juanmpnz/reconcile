/** Shared base styles cannot be accidentally removed or repeated by a consumer. */
export function componentClasses(base: string, extra = '') {
  return [...new Set(`${base} ${extra}`.split(/\s+/).filter(Boolean))].join(
    ' ',
  );
}

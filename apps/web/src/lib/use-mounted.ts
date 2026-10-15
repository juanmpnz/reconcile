import { useEffect, useRef } from 'react';
// Prevent a completed request from redirecting a route that no longer owns it.
export function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

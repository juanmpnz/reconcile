import type { z } from 'zod';

export const SESSION_EXPIRED_EVENT = 'reconcile:session-expired';

/** A failed HTTP request; the public message never contains response bodies. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** The only fetch transport for the application's same-origin API.
 * Feature policies map status codes to their existing domain conflict errors.
 * Better Auth retains its SDK transport and cookie handling.
 */
export async function httpFetch(url: string, init: RequestInit = {}) {
  if (!url.startsWith('/api/') || url.startsWith('//') || url.includes('\\'))
    throw new Error(
      'La solicitud no corresponde al servicio de la aplicación.',
    );
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    redirect: 'error',
  });
  if (response.status === 401 && typeof window !== 'undefined')
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return response;
}

export function parseHttpResponse<T>(
  schema: z.ZodType<T>,
  body: unknown,
  message: string,
): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new Error(message);
  return result.data;
}

export async function readHttpJson(
  response: Response,
  message: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(message);
  }
}

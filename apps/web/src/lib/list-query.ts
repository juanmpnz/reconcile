import { z } from 'zod';
export type ServerListOptions = {
  q?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
};
export function serverListParams(
  page: number,
  options: ServerListOptions,
  sorts: readonly [string, ...string[]],
) {
  const filters = z
    .object({
      q: z.string().trim().max(200).default(''),
      sort: z.enum(sorts).default('createdAt'),
      direction: z.enum(['asc', 'desc']).default('desc'),
      limit: z.number().int().min(1).max(100).default(25),
    })
    .strict()
    .parse(options);
  const offset = z
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(page * filters.limit);
  return new URLSearchParams({
    q: filters.q,
    sort: filters.sort,
    direction: filters.direction,
    limit: String(filters.limit),
    offset: String(offset),
  });
}

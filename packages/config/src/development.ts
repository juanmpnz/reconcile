import { z } from 'zod';
const developmentSchema = z.object({
  DEV_API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});
export function parseDevelopmentConfig(
  environment: Record<string, string | undefined>,
): z.infer<typeof developmentSchema> {
  const result = developmentSchema.safeParse(environment);
  if (!result.success)
    throw new Error('Invalid development environment: DEV_API_PORT');
  return result.data;
}

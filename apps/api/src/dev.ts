import { parseDevelopmentConfig } from '@reconcile/config';
if (process.env.NODE_ENV === 'production')
  throw new Error('Development launcher cannot run with NODE_ENV=production');
// Development has its own listener setting, independent of a deployment PORT in .env.
const { DEV_API_PORT } = parseDevelopmentConfig(process.env);
process.env.PORT = String(DEV_API_PORT);
await import('./main.js');

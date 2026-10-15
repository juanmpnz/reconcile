import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { parseDevelopmentConfig } from '@reconcile/config';
const environmentFile = fileURLToPath(new URL('../../.env', import.meta.url));
export default defineConfig(({ command }) => {
  if (command === 'build') return { plugins: [react()] };
  // Match the API's Node --env-file=.env contract and process-environment precedence.
  const environment = existsSync(environmentFile)
    ? parseEnv(readFileSync(environmentFile, 'utf8'))
    : {};
  const { DEV_API_PORT } = parseDevelopmentConfig({
    DEV_API_PORT: process.env.DEV_API_PORT ?? environment.DEV_API_PORT,
  });
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${DEV_API_PORT}` },
    },
  };
});

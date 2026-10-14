import { spawnSync } from 'node:child_process';
const result = spawnSync(
  'pnpm',
  ['--filter', '@reconcile/database', 'migrate'],
  { stdio: 'inherit', env: process.env },
);
if (result.error) {
  console.error('Could not start migration command');
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}

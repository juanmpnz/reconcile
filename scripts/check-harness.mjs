import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const nonempty = (value, label) =>
  assert.ok(typeof value === 'string' && value.trim().length > 0, label);
const manifest = readJson('.agents/manifest.json');
assert.equal(manifest.version, 1);
assert.ok(Array.isArray(manifest.roles) && manifest.roles.length > 0);
const roles = new Set();
for (const role of manifest.roles) {
  assert.match(role.id, /^[a-z]+(?:-[a-z]+)*$/);
  assert.ok(!roles.has(role.id), `Duplicate role ${role.id}`);
  roles.add(role.id);
  nonempty(role.title, 'Role title required');
  nonempty(role.description, 'Role description required');
  assert.ok(
    ['routing', 'planning', 'implementation', 'review'].includes(role.mode),
  );
  assert.equal(role.profile, `.agents/roles/${role.id}.md`);
  const profile = readFileSync(role.profile, 'utf8');
  for (const heading of [
    '## Misión',
    '## Lectura obligatoria',
    '## Responsabilidades',
    '## Entrega',
    '## Límites',
  ])
    assert.ok(profile.includes(heading), `${role.id}: missing ${heading}`);
}
for (const route of manifest.routes) {
  nonempty(route.id, 'Route id required');
  assert.ok(route.patterns.length > 0 && route.roles.length > 0);
  route.patterns.forEach((pattern) => new RegExp(pattern));
  route.roles.forEach((role) =>
    assert.ok(roles.has(role), `Unknown routing role: ${role}`),
  );
}
for (const adapter of ['.codex/agents', '.claude/agents']) {
  assert.equal(
    readdirSync(adapter).length,
    roles.size,
    `Unexpected adapters in ${adapter}`,
  );
}
execFileSync(process.execPath, ['scripts/sync-agents.mjs', '--check'], {
  stdio: 'inherit',
});
for (const path of [
  'AGENTS.md',
  'CLAUDE.md',
  '.agents/WORKFLOW.md',
  'docs/engineering/harness.md',
]) {
  nonempty(readFileSync(path, 'utf8'), path);
}

function validateTask(task) {
  for (const key of [
    'id',
    'summary',
    'owner',
    'implementer',
    'semanticRouting',
  ])
    nonempty(task[key], `Missing ${key}`);
  assert.ok(
    ['planned', 'implementing', 'reviewed', 'verified', 'blocked'].includes(
      task.state,
    ),
    `Invalid task state: ${task.id}`,
  );
  assert.equal(task.owner, 'principal-engineer');
  assert.ok(
    [
      'documentation',
      'harness',
      'ui',
      'backend',
      'data',
      'integration',
      'security',
      'platform',
      'domain',
    ].includes(task.changeClass),
    'Explicit change class required',
  );
  assert.ok(
    ['low', 'medium', 'high'].includes(task.risk),
    'Explicit risk classification required',
  );
  assert.equal(
    typeof task.independentReviewRequired,
    'boolean',
    'Explicit independence decision required',
  );
  nonempty(task.independenceRationale, 'Independence rationale required');
  if (task.risk !== 'low' || task.changeClass === 'security')
    assert.equal(
      task.independentReviewRequired,
      true,
      'Risk requires independent review',
    );
  for (const key of [
    'scope',
    'acceptance',
    'requiredRoles',
    'reviews',
    'excludedRoles',
    'checks',
    'findings',
    'limitations',
    'evidence',
  ])
    assert.ok(Array.isArray(task[key]), `Missing array ${key}`);
  assert.ok(
    task.scope.length > 0 && task.acceptance.length > 0,
    `Task lacks scope or acceptance: ${task.id}`,
  );
  task.scope.forEach((path) => {
    nonempty(path, 'Scope path required');
    assert.ok(
      !path.startsWith('/') && !path.split('/').includes('..'),
      'Scope must be repo-relative',
    );
  });
  assert.ok(task.requiredRoles.includes('principal-engineer'));
  assert.equal(new Set(task.requiredRoles).size, task.requiredRoles.length);
  task.requiredRoles.forEach((role) =>
    assert.ok(roles.has(role), `Unknown required role ${role}`),
  );
  const excluded = new Set();
  for (const exclusion of task.excludedRoles) {
    assert.ok(roles.has(exclusion.role));
    assert.ok(!excluded.has(exclusion.role), 'Duplicate role exclusion');
    excluded.add(exclusion.role);
    assert.ok(
      !task.requiredRoles.includes(exclusion.role),
      'Required roles cannot also be excluded',
    );
    nonempty(exclusion.reason, 'Exclusion requires rationale');
  }
  for (const review of task.reviews) {
    assert.ok(
      task.requiredRoles.includes(review.role),
      `Review role not assigned: ${review.role}`,
    );
    nonempty(review.reviewer, 'Reviewer identity required');
    assert.ok(['independent', 'sequential'].includes(review.mode));
    assert.ok(
      ['passed', 'changes-requested', 'not-run'].includes(review.status),
    );
    nonempty(
      review.examined,
      'Review must identify examined revision or bounded diff',
    );
    assert.ok(
      Array.isArray(review.evidence) && review.evidence.length > 0,
      'Review requires evidence',
    );
    if (review.mode === 'independent')
      assert.notEqual(
        review.reviewer,
        task.implementer,
        'Implementer cannot self-certify independence',
      );
    review.evidence.forEach((path) => {
      nonempty(path, 'Evidence required');
      if (!/^https:\/\//.test(path))
        assert.ok(existsSync(path), `Missing review evidence: ${path}`);
    });
  }
  for (const check of task.checks) {
    nonempty(check.command, 'Check command required');
    assert.ok(['passed', 'failed', 'not-run'].includes(check.status));
    nonempty(check.result, 'Check result required');
  }
  for (const finding of task.findings) {
    nonempty(finding.id, 'Finding id required');
    nonempty(finding.summary, 'Finding description required');
    assert.ok(['critical', 'high', 'medium', 'low'].includes(finding.severity));
    assert.ok(['open', 'resolved', 'accepted'].includes(finding.status));
    nonempty(finding.resolution, 'Finding resolution or next step required');
  }
  if (task.state === 'verified') {
    for (const role of task.requiredRoles)
      assert.ok(
        task.reviews.filter((review) => review.role === role).at(-1)?.status ===
          'passed',
        `No passed review: ${task.id}/${role}`,
      );
    assert.ok(
      task.checks.some((check) => check.status === 'passed'),
      'Verified task requires executed verification',
    );
    assert.ok(
      !task.checks.some((check) => check.status === 'failed'),
      'Failed check blocks verified state',
    );
    assert.ok(
      !task.findings.some(
        (finding) =>
          ['critical', 'high'].includes(finding.severity) &&
          finding.status !== 'resolved',
      ),
      'Unresolved critical/high finding',
    );
    assert.ok(task.evidence.length > 0, 'Verified task requires evidence');
    if (task.independentReviewRequired)
      assert.ok(
        task.reviews.some(
          (review) =>
            review.mode === 'independent' &&
            review.role !== 'principal-engineer' &&
            review.status === 'passed' &&
            task.reviews.filter((item) => item.role === review.role).at(-1) ===
              review,
        ),
        'Independent review required',
      );
  }
}
const tasks = readdirSync('.agents/tasks')
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({
    path: `.agents/tasks/${name}`,
    task: readJson(`.agents/tasks/${name}`),
  }));
const taskIds = new Set();
for (const item of tasks) {
  validateTask(item.task);
  assert.ok(!taskIds.has(item.task.id), 'Duplicate task id');
  taskIds.add(item.task.id);
}

if (process.argv.includes('--gate')) {
  const baseIndex = process.argv.indexOf('--base');
  const base =
    baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.HARNESS_BASE_SHA;
  assert.ok(
    base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base),
    'Gate requires a valid existing base SHA',
  );
  execFileSync('git', ['cat-file', '-e', `${base}^{commit}`]);
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRTUXB', base, '--'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const changedTasks = tasks.filter((item) => changed.includes(item.path));
  assert.ok(
    changed.length === 0 || changedTasks.length > 0,
    'Changed files require an updated task record',
  );
  for (const file of changed) {
    const owners = changedTasks.filter(({ task }) =>
      task.scope.some(
        (scope) =>
          file === scope || (scope.endsWith('/') && file.startsWith(scope)),
      ),
    );
    assert.ok(owners.length > 0, `No task covers ${file}`);
    const required = new Set(
      manifest.routes
        .filter((route) =>
          route.patterns.some((pattern) => new RegExp(pattern).test(file)),
        )
        .flatMap((route) => route.roles),
    );
    assert.ok(
      owners.some(({ task }) =>
        [...required].every(
          (role) =>
            task.requiredRoles.includes(role) ||
            task.excludedRoles.some((exclusion) => exclusion.role === role),
        ),
      ),
      `Routing not accounted for: ${file}`,
    );
    for (const { task } of owners) {
      assert.ok(task.state === 'verified', `Task is not verified: ${task.id}`);
      const sensitive = manifest.routes.some(
        (route) =>
          ['identity', 'data', 'business', 'documents', 'connectors'].includes(
            route.id,
          ) && route.patterns.some((pattern) => new RegExp(pattern).test(file)),
      );
      const executionPolicy =
        /^(scripts\/(check-harness|sync-agents)\.mjs$|\.github\/workflows\/)/.test(
          file,
        );
      if (sensitive || executionPolicy)
        assert.equal(
          task.independentReviewRequired,
          true,
          `Sensitive path requires independent specialist review: ${file}`,
        );
    }
  }
  console.info(
    `Diff gate: ${changed.length} paths covered by ${changedTasks.length} updated task record(s).`,
  );
}
console.info(
  `Harness validated: ${roles.size} roles, ${tasks.length} task record(s). Evidence is declared; human/agent review authenticity is not certified by this check.`,
);

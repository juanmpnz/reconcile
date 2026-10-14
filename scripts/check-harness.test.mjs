import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'reconcile-harness-test-'));
  const command = (program, args) =>
    spawnSync(program, args, { cwd: root, encoding: 'utf8' });
  const git = (...args) => {
    const result = command('git', args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    for (const path of [
      '.agents/manifest.json',
      '.agents/roles',
      '.agents/WORKFLOW.md',
      '.codex/agents',
      '.claude/agents',
      'AGENTS.md',
      'CLAUDE.md',
      'docs/engineering/harness.md',
      'scripts/check-harness.mjs',
      'scripts/sync-agents.mjs',
    ]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      cpSync(path, join(root, path), { recursive: true });
    }
    mkdirSync(join(root, '.agents/tasks'), { recursive: true });
    git('init', '-b', 'main');
    git('add', '.');
    git(
      '-c',
      'user.name=Harness Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'fixture baseline',
    );
    const base = git('rev-parse', 'HEAD');
    const roles = [
      'principal-engineer',
      'solution-architect',
      'security-engineer',
      'backend-engineer',
      'qa-engineer',
    ];
    const task = {
      id: 'synthetic-regression',
      summary: 'Synthetic policy regression, not actual expert evidence',
      state: 'verified',
      owner: 'principal-engineer',
      implementer: 'synthetic-author',
      changeClass: 'security',
      risk: 'medium',
      independentReviewRequired: true,
      independenceRationale:
        'Synthetic identity change tests policy enforcement',
      scope: ['.agents/tasks/', 'apps/api/'],
      acceptance: ['Policy rejects incomplete independent review metadata'],
      requiredRoles: roles,
      semanticRouting: 'Synthetic auth-path policy test only',
      excludedRoles: [],
      reviews: roles.map((role) => ({
        role,
        reviewer:
          role === 'security-engineer'
            ? 'synthetic-independent-reviewer'
            : 'synthetic-author',
        mode: role === 'security-engineer' ? 'independent' : 'sequential',
        status: 'passed',
        examined: 'Synthetic fixture',
        evidence: ['.agents/WORKFLOW.md'],
      })),
      checks: [
        {
          command: 'synthetic-fixture',
          status: 'passed',
          result: 'Fixture metadata only',
        },
      ],
      findings: [],
      limitations: [],
      evidence: ['.agents/WORKFLOW.md'],
    };
    const gate = () => {
      mkdirSync(join(root, 'apps/api/src/modules/auth'), { recursive: true });
      writeFileSync(
        join(root, 'apps/api/src/modules/auth/fixture.ts'),
        'export const fixture = true;\n',
      );
      writeFileSync(
        join(root, '.agents/tasks/synthetic.json'),
        JSON.stringify(task),
      );
      git('add', '.');
      const result = command(process.execPath, [
        'scripts/check-harness.mjs',
        '--gate',
        '--base',
        base,
      ]);
      return { ...result, log: result.stdout + result.stderr };
    };
    run({ task, gate, root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('valid independent specialist review passes the routed gate', () =>
  fixture(({ gate }) => {
    const result = gate();
    assert.equal(result.status, 0, result.log);
  }));
test('missing independence flag fails closed', () =>
  fixture(({ task, gate }) => {
    delete task.independentReviewRequired;
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Explicit independence decision/);
  }));
test('coordinator-only independence cannot approve substantive work', () =>
  fixture(({ task, gate }) => {
    task.reviews.forEach((review) => {
      review.mode =
        review.role === 'principal-engineer' ? 'independent' : 'sequential';
      review.reviewer =
        review.role === 'principal-engineer'
          ? 'synthetic-coordinator'
          : task.implementer;
    });
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Independent review required/);
  }));
test('identity paths cannot evade independence through low-risk self-classification', () =>
  fixture(({ task, gate }) => {
    task.changeClass = 'documentation';
    task.risk = 'low';
    task.independentReviewRequired = false;
    task.reviews.forEach((review) => {
      review.mode = 'sequential';
      review.reviewer = task.implementer;
    });
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Sensitive path requires independent/);
  }));
test('missing routed security specialist fails', () =>
  fixture(({ task, gate }) => {
    task.requiredRoles = task.requiredRoles.filter(
      (role) => role !== 'security-engineer',
    );
    task.reviews = task.reviews.filter(
      (review) => review.role !== 'security-engineer',
    );
    task.reviews.find((review) => review.role === 'qa-engineer').mode =
      'independent';
    task.reviews.find((review) => review.role === 'qa-engineer').reviewer =
      'synthetic-independent-reviewer';
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Routing not accounted/);
  }));
test('later changes-requested supersedes an earlier approval', () =>
  fixture(({ task, gate }) => {
    task.reviews.push({
      ...task.reviews.find((review) => review.role === 'security-engineer'),
      status: 'changes-requested',
    });
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /No passed review/);
  }));
test('unresolved high findings block verification', () =>
  fixture(({ task, gate }) => {
    task.findings.push({
      id: 'synthetic-high',
      severity: 'high',
      status: 'open',
      summary: 'Synthetic unresolved finding',
      resolution: 'Not fixed in fixture',
    });
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Unresolved critical/);
  }));
test('stale generated adapters are detected', () =>
  fixture(({ root, gate }) => {
    writeFileSync(
      join(root, '.codex/agents/qa-engineer.toml'),
      'name = "stale"\n',
    );
    const result = gate();
    assert.notEqual(result.status, 0);
    assert.match(result.log, /Stale or missing adapter/);
  }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'bin', 'cli.js');

function runNode(args, cwd = repoRoot) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd,
        encoding: 'utf8',
    });
    return {
        code: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        combined: `${result.stdout || ''}${result.stderr || ''}`,
    };
}

function runShell(command, cwd = repoRoot) {
    return spawnSync(command, {
        cwd,
        shell: true,
        encoding: 'utf8',
    });
}

function makeTempDir(name) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `agent-memory-${name}-`));
    return dir;
}

function writeMemory(filePath, overrides = {}) {
    const content = [
        '---',
        `name: ${overrides.name || 'Test Memory'}`,
        `type: ${overrides.type || 'user'}`,
        `tags: ${overrides.tags || '[test]'}`,
        `confidence: ${overrides.confidence !== undefined ? overrides.confidence : 0.9}`,
        `created: ${overrides.created || '2026-01-01'}`,
        `last_accessed: ${overrides.last_accessed || '2026-01-01'}`,
        `access_count: ${overrides.access_count !== undefined ? overrides.access_count : 1}`,
        `ttl: ${overrides.ttl !== undefined ? overrides.ttl : 'null'}`,
        `related: ${overrides.related || '[]'}`,
        '---',
        '',
        overrides.body || 'Memory body.',
        '',
        '**Why:** test',
        '**How to apply:** test',
        '',
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
}

function testInitSkipsExamples() {
    const dir = makeTempDir('init');
    const res = runNode(['init', '--path', dir]);
    assert.strictEqual(res.code, 0, `init failed: ${res.combined}`);

    const userFiles = fs.readdirSync(path.join(dir, 'user'));
    assert(!userFiles.some(f => /^example-.*\.md$/i.test(f)), 'example files should not be copied to user/');

    const projectFiles = fs.readdirSync(path.join(dir, 'project'));
    assert(!projectFiles.some(f => /^example-.*\.md$/i.test(f)), 'example files should not be copied to project/');

    const feedbackFiles = fs.readdirSync(path.join(dir, 'feedback'));
    assert(!feedbackFiles.some(f => /^example-.*\.md$/i.test(f)), 'example files should not be copied to feedback/');
}

function testTouchMemorySupportsPosixAndWindowsPath() {
    const dir = makeTempDir('touch');
    assert.strictEqual(runNode(['init', '--path', dir]).code, 0, 'init failed');

    const memPath = path.join(dir, 'user', 'pref.md');
    writeMemory(memPath, { access_count: 0, last_accessed: '2026-01-01' });

    let res = runNode(['touch-memory', '--path', dir, '--file', 'user/pref.md']);
    assert.strictEqual(res.code, 0, `touch-memory (posix path) failed: ${res.combined}`);

    res = runNode(['touch-memory', '--path', dir, '--file', 'user\\pref.md']);
    assert.strictEqual(res.code, 0, `touch-memory (windows path) failed: ${res.combined}`);

    const updated = fs.readFileSync(memPath, 'utf8');
    assert(updated.includes('access_count: 2'), 'access_count should be incremented twice');
}

function testSessionEndThresholdTriggersMaintain() {
    const dir = makeTempDir('session-end');
    assert.strictEqual(runNode(['init', '--path', dir]).code, 0, 'init failed');

    writeMemory(path.join(dir, 'user', 's.md'));

    let res = runNode(['session-end', '--path', dir, '--threshold', '2']);
    assert.strictEqual(res.code, 0, `session-end #1 failed: ${res.combined}`);
    let state = JSON.parse(fs.readFileSync(path.join(dir, '.maintenance-state.json'), 'utf8'));
    assert.strictEqual(state.maintenanceCount, 1, 'maintenanceCount should be 1 after first session-end');

    res = runNode(['session-end', '--path', dir, '--threshold', '2']);
    assert.strictEqual(res.code, 0, `session-end #2 failed: ${res.combined}`);
    state = JSON.parse(fs.readFileSync(path.join(dir, '.maintenance-state.json'), 'utf8'));
    assert.strictEqual(state.maintenanceCount, 0, 'maintenanceCount should reset after threshold maintain');
}

function testMaintainBucketDecay() {
    const dir = makeTempDir('decay');
    assert.strictEqual(runNode(['init', '--path', dir]).code, 0, 'init failed');

    writeMemory(path.join(dir, 'user', 'old.md'), {
        confidence: 1.0,
        last_accessed: '2025-12-21',
        ttl: 'null',
    });

    const res = runNode(['maintain', '--path', dir]);
    assert.strictEqual(res.code, 0, `maintain failed: ${res.combined}`);
    const updated = fs.readFileSync(path.join(dir, 'user', 'old.md'), 'utf8');
    assert(updated.includes('confidence: 0.51'), 'confidence should decay to 0.51 for 95 days (3 buckets)');
}

function testRebuildIndexHardCap() {
    const dir = makeTempDir('cap');
    assert.strictEqual(runNode(['init', '--path', dir]).code, 0, 'init failed');

    const feedbackDir = path.join(dir, 'feedback');
    for (let i = 1; i <= 240; i++) {
        const confidence = Math.max(0, Math.round(((240 - i) / 240) * 100) / 100);
        writeMemory(path.join(feedbackDir, `bulk-${i}.md`), {
            name: `Bulk ${i}`,
            type: 'feedback',
            confidence,
            last_accessed: '2026-03-01',
        });
    }

    const res = runNode(['rebuild-index', '--path', dir]);
    assert.strictEqual(res.code, 0, `rebuild-index failed: ${res.combined}`);
    assert(res.combined.includes('Index pruning applied'), 'rebuild-index should report pruning when cap is exceeded');

    const lineCount = fs.readFileSync(path.join(dir, 'MEMORY.md'), 'utf8').split('\n').length;
    assert(lineCount <= 200, `MEMORY.md should be <= 200 lines, got ${lineCount}`);
}

function testValidationWarnings() {
    const dir = makeTempDir('validation');
    assert.strictEqual(runNode(['init', '--path', dir]).code, 0, 'init failed');

    writeMemory(path.join(dir, 'user', 'bad.md'), {
        type: 'invalid_type',
        confidence: 1.5,
        last_accessed: 'yesterday',
    });

    const res = runNode(['rebuild-index', '--path', dir]);
    assert.strictEqual(res.code, 0, `rebuild-index failed: ${res.combined}`);
    assert(res.combined.includes('Validation warnings'), 'should print validation warnings for invalid frontmatter');
}

function testSetupHooksConfiguresSettings() {
    const dir = makeTempDir('setup-hooks');

    // First install so .memark exists
    const installRes = runNode(['install'], dir);
    assert.strictEqual(installRes.code, 0, `install failed: ${installRes.combined}`);

    // Verify .claude/settings.json was created with hooks
    const settingsPath = path.join(dir, '.claude', 'settings.json');
    assert(fs.existsSync(settingsPath), '.claude/settings.json should exist after install');

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert(settings.hooks, 'settings should have hooks');
    assert(settings.hooks.SessionStart, 'should have SessionStart hook');
    assert(settings.hooks.SessionEnd, 'should have SessionEnd hook');
    assert(settings.hooks.SessionStart[0].matcher === 'startup|resume|clear|compact',
        'SessionStart matcher should cover all scenarios');

    // Run setup-hooks again with existing settings — should not duplicate
    const cliInDir = path.join(dir, '.memark', 'bin', 'cli.js');
    const res2 = spawnSync(process.execPath, [cliInDir, 'setup-hooks'], {
        cwd: dir,
        encoding: 'utf8',
    });
    assert.strictEqual(res2.status, 0, `setup-hooks failed: ${res2.stdout}${res2.stderr}`);

    const settings2 = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.strictEqual(settings2.hooks.SessionStart.length, 1, 'should not duplicate SessionStart hooks');
    assert.strictEqual(settings2.hooks.SessionEnd.length, 1, 'should not duplicate SessionEnd hooks');

    // Test merging with existing non-memark hooks
    settings2.hooks.PreToolUse = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo test' }] }];
    fs.writeFileSync(settingsPath, JSON.stringify(settings2, null, 2), 'utf8');

    const res3 = spawnSync(process.execPath, [cliInDir, 'setup-hooks'], {
        cwd: dir,
        encoding: 'utf8',
    });
    assert.strictEqual(res3.status, 0, `setup-hooks merge failed: ${res3.stdout}${res3.stderr}`);

    const settings3 = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert(settings3.hooks.PreToolUse, 'should preserve existing non-memark hooks');
    assert.strictEqual(settings3.hooks.PreToolUse.length, 1, 'should not modify non-memark hooks');
}

function testNpmPackDryRun() {
    const result = runShell('npm pack --dry-run');
    assert.strictEqual(result.status, 0, `npm pack --dry-run failed: ${result.stdout}\n${result.stderr}`);
}

function testInstallCreatesDotMemarkAndUpdatesClaudeMd() {
    const dir = makeTempDir('install');

    const first = runNode(['install'], dir);
    assert.strictEqual(first.code, 0, `install failed: ${first.combined}`);

    const installedCli = path.join(dir, '.memark', 'bin', 'cli.js');
    assert(fs.existsSync(installedCli), 'install should place runtime under .memark/bin/cli.js');

    const memoryIndex = path.join(dir, 'memory', 'MEMORY.md');
    assert(fs.existsSync(memoryIndex), 'install should initialize memory workspace');

    const claudePath = path.join(dir, 'CLAUDE.md');
    assert(fs.existsSync(claudePath), 'install should create CLAUDE.md when missing');

    const blockStart = '<!-- MEMARK:START -->';
    let claude = fs.readFileSync(claudePath, 'utf8');
    assert(claude.includes(blockStart), 'CLAUDE.md should include managed memark block');

    const second = runNode(['install'], dir);
    assert.strictEqual(second.code, 0, `second install failed: ${second.combined}`);

    claude = fs.readFileSync(claudePath, 'utf8');
    const occurrences = claude.split(blockStart).length - 1;
    assert.strictEqual(occurrences, 1, 'install should update CLAUDE.md block in place (no duplicate blocks)');
}

function testNoArgDefaultsToInstall() {
    const dir = makeTempDir('install-default');
    const res = runNode([], dir);
    assert.strictEqual(res.code, 0, `default (no-arg) run should install: ${res.combined}`);
    assert(fs.existsSync(path.join(dir, '.memark', 'bin', 'cli.js')), 'no-arg run should install .memark runtime');
    assert(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'no-arg run should create CLAUDE.md');
}

function run() {
    const tests = [
        ['init skips example memories', testInitSkipsExamples],
        ['install writes .memark and CLAUDE.md block', testInstallCreatesDotMemarkAndUpdatesClaudeMd],
        ['no-arg defaults to install', testNoArgDefaultsToInstall],
        ['touch-memory supports both slash styles', testTouchMemorySupportsPosixAndWindowsPath],
        ['session-end triggers maintain by threshold', testSessionEndThresholdTriggersMaintain],
        ['maintain applies bucketed decay', testMaintainBucketDecay],
        ['rebuild-index enforces hard 200-line cap', testRebuildIndexHardCap],
        ['frontmatter validation warnings are emitted', testValidationWarnings],
        ['setup-hooks configures .claude/settings.json', testSetupHooksConfiguresSettings],
        ['npm pack dry-run succeeds', testNpmPackDryRun],
    ];

    let passed = 0;
    for (const [name, fn] of tests) {
        try {
            fn();
            passed++;
            console.log(`PASS ${name}`);
        } catch (err) {
            console.error(`FAIL ${name}`);
            console.error(err && err.stack ? err.stack : err);
            process.exit(1);
        }
    }

    console.log(`\n${passed}/${tests.length} tests passed.`);
}

run();

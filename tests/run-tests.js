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

function testNpmPackDryRun() {
    const result = runShell('npm pack --dry-run');
    assert.strictEqual(result.status, 0, `npm pack --dry-run failed: ${result.stdout}\n${result.stderr}`);
}

function run() {
    const tests = [
        ['init skips example memories', testInitSkipsExamples],
        ['touch-memory supports both slash styles', testTouchMemorySupportsPosixAndWindowsPath],
        ['session-end triggers maintain by threshold', testSessionEndThresholdTriggersMaintain],
        ['maintain applies bucketed decay', testMaintainBucketDecay],
        ['rebuild-index enforces hard 200-line cap', testRebuildIndexHardCap],
        ['frontmatter validation warnings are emitted', testValidationWarnings],
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

const fs = require('fs');
const path = require('path');
const { init } = require('./init');

const MANAGED_BLOCK_START = '<!-- MEMARK:START -->';
const MANAGED_BLOCK_END = '<!-- MEMARK:END -->';

const CLAUDE_SNIPPET = `${MANAGED_BLOCK_START}
## memark Memory Hooks (auto-managed)

This block is managed by memark ` + '`install`' + `.
Claude/Codex agents should follow this workflow:

- Session start: run ` + '`node ./.memark/bin/cli.js rebuild-index`' + `, then read ` + '`memory/MEMORY.md`' + ` and ` + '`memory/AGENT-INSTRUCTIONS.md`' + `.
- After reading memory: run ` + '`node ./.memark/bin/cli.js touch-memory --file <type/file.md>`' + `.
- Session end: run ` + '`node ./.memark/bin/cli.js session-end --threshold 10`' + `.
- Manual maintenance: run ` + '`node ./.memark/bin/cli.js maintain`' + `.
${MANAGED_BLOCK_END}`;

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const name of fs.readdirSync(src)) {
            const srcPath = path.join(src, name);
            const destPath = path.join(dest, name);
            copyRecursive(srcPath, destPath);
        }
        return;
    }
    fs.copyFileSync(src, dest);
}

function upsertClaudeMd(projectRoot) {
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    if (!fs.existsSync(claudePath)) {
        fs.writeFileSync(claudePath, `${CLAUDE_SNIPPET}\n`, 'utf8');
        return { created: true, updated: false };
    }

    const existing = fs.readFileSync(claudePath, 'utf8');
    const startIdx = existing.indexOf(MANAGED_BLOCK_START);
    const endIdx = existing.indexOf(MANAGED_BLOCK_END);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const before = existing.slice(0, startIdx).trimEnd();
        const after = existing.slice(endIdx + MANAGED_BLOCK_END.length).trimStart();
        const merged = [before, CLAUDE_SNIPPET, after].filter(Boolean).join('\n\n');
        fs.writeFileSync(claudePath, `${merged}\n`, 'utf8');
        return { created: false, updated: true };
    }

    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(claudePath, `${existing}${separator}${CLAUDE_SNIPPET}\n`, 'utf8');
    return { created: false, updated: true };
}

function install(options = {}) {
    const projectRoot = process.cwd();
    const packageRoot = path.join(__dirname, '..');
    const targetRoot = path.join(projectRoot, '.memark');

    if (fs.existsSync(targetRoot) && options.force) {
        fs.rmSync(targetRoot, { recursive: true, force: true });
    }
    if (!fs.existsSync(targetRoot)) fs.mkdirSync(targetRoot, { recursive: true });

    const toCopy = ['bin', 'lib', 'templates', 'package.json', 'README.md', 'INTEGRATION.md', 'spec.md'];
    for (const name of toCopy) {
        const src = path.join(packageRoot, name);
        const dest = path.join(targetRoot, name);
        if (fs.existsSync(src)) copyRecursive(src, dest);
    }

    const memoryDir = path.join(projectRoot, 'memory');
    const needsInit = !fs.existsSync(memoryDir) || fs.readdirSync(memoryDir).length === 0;
    if (needsInit) {
        init({ customPath: memoryDir, force: true });
    }

    const claudeResult = upsertClaudeMd(projectRoot);

    console.log('\n✓ memark project install complete');
    console.log(`  Installed runtime: ${path.join(targetRoot, 'bin', 'cli.js')}`);
    console.log(`  Memory workspace:  ${memoryDir}`);
    if (claudeResult.created) {
        console.log('  CLAUDE.md: created and memark block inserted');
    } else if (claudeResult.updated) {
        console.log('  CLAUDE.md: updated with memark block');
    }
    console.log('');
    console.log('Recommended hook commands:');
    console.log('  node ./.memark/bin/cli.js rebuild-index');
    console.log('  node ./.memark/bin/cli.js touch-memory --file <type/file.md>');
    console.log('  node ./.memark/bin/cli.js session-end --threshold 10');
    console.log('  node ./.memark/bin/cli.js maintain');
    console.log('');
}

module.exports = { install, MANAGED_BLOCK_START, MANAGED_BLOCK_END };

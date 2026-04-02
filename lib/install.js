const fs = require('fs');
const path = require('path');
const { init } = require('./init');
const { setupHooks } = require('./setup-hooks');

const MANAGED_BLOCK_START = '<!-- MEMARK:START -->';
const MANAGED_BLOCK_END = '<!-- MEMARK:END -->';

const CLAUDE_SNIPPET = `${MANAGED_BLOCK_START}
## memark Memory System (auto-managed)

Hooks are configured in ` + '`.claude/settings.json`' + ` to automatically:
- Load memory index at session start (injected into context via hooks)
- Run maintenance at session end

Memory files are stored in ` + '`./.memark/`' + ` as flat Markdown files.
Read ` + '`.memark/AGENT-INSTRUCTIONS.md`' + ` for the memory writing protocol.

To manually manage: ` + '`node ./.memark/bin/cli.js <command>`' + `
Commands: rebuild-index, touch-memory --file <path>, session-end, maintain
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

    // Initialize memory templates in .memark/ (same directory as runtime)
    init({ customPath: targetRoot, force: true });

    const claudeResult = upsertClaudeMd(projectRoot);
    const hooksResult = setupHooks(projectRoot);

    console.log('\n✓ memark project install complete');
    console.log(`  Runtime + memory: ${targetRoot}`);
    if (claudeResult.created) {
        console.log('  CLAUDE.md: created and memark block inserted');
    } else if (claudeResult.updated) {
        console.log('  CLAUDE.md: updated with memark block');
    }
    console.log(`  Hooks: configured in ${hooksResult.settingsPath}`);
    console.log('');
    console.log('Hooks configured (automatic):');
    console.log('  SessionStart → rebuild-index + inject memory into context');
    console.log('  SessionEnd   → session-end maintenance');
    console.log('');
    console.log('Manual commands:');
    console.log('  node ./.memark/bin/cli.js rebuild-index');
    console.log('  node ./.memark/bin/cli.js touch-memory --file <filename.md>');
    console.log('  node ./.memark/bin/cli.js maintain');
    console.log('');
}

module.exports = { install, MANAGED_BLOCK_START, MANAGED_BLOCK_END };

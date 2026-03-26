const fs = require('fs');
const path = require('path');
const os = require('os');

function getTargetDir(options) {
    if (options.customPath) return path.resolve(options.customPath);
    if (options.global) return path.join(os.homedir(), '.claude', 'memory');
    return path.join(process.cwd(), 'memory');
}

function shouldCopyEntry(entry) {
    if (entry.isDirectory() && entry.name === 'examples') return false;
    return !(entry.isFile() && /^example-.*\.md$/i.test(entry.name));
}

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        if (!shouldCopyEntry(entry)) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            let content = fs.readFileSync(srcPath, 'utf8');
            // Replace template placeholders
            content = content.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
            fs.writeFileSync(destPath, content);
        }
    }
}

function init(options = {}) {
    const targetDir = getTargetDir(options);
    const templatesDir = path.join(__dirname, '..', 'templates');

    // Check if already exists
    if (fs.existsSync(targetDir) && !options.force) {
        const existing = fs.readdirSync(targetDir);
        if (existing.length > 0) {
            console.error(`\n✗ Memory directory already exists: ${targetDir}`);
            console.error('  Use --force to overwrite, or choose a different location.\n');
            process.exit(1);
        }
    }

    console.log(`\nInitializing agent memory system...`);
    console.log(`  Target: ${targetDir}`);
    console.log(`  Mode:   ${options.global ? 'global' : 'project-level'}\n`);

    copyDir(templatesDir, targetDir);

    console.log('✓ Memory system initialized!\n');
    console.log('Directory structure:');
    console.log('  memory/');
    console.log('  ├── MEMORY.md              ← Agent reads this every session');
    console.log('  ├── AGENT-INSTRUCTIONS.md  ← Full operating protocol');
    console.log('  ├── MAINTENANCE.md         ← Maintenance protocol');
    console.log('  ├── TEMPLATE.md            ← Template for new memories');
    console.log('  ├── user/                  ← User preferences & habits');
    console.log('  ├── project/               ← Project decisions & context');
    console.log('  ├── patterns/              ← Distilled work patterns');
    console.log('  ├── feedback/              ← Agent behavior corrections');
    console.log('  └── archive/               ← Low-confidence memory archive');
    console.log('');
    console.log('Note: Example memory files in the package are reference-only and are not installed by default.');
    console.log('');

    if (options.global) {
        console.log('Next step: Add this to your ~/.claude/CLAUDE.md:');
        console.log('');
        console.log('  At the start of every session, read memory/MEMORY.md and follow');
        console.log('  memory/AGENT-INSTRUCTIONS.md for the full operating protocol.');
        console.log('');
    } else {
        console.log('Next step: Add this to your project CLAUDE.md:');
        console.log('');
        console.log('  At the start of every session, read memory/MEMORY.md and follow');
        console.log('  memory/AGENT-INSTRUCTIONS.md for the full operating protocol.');
        console.log('');
    }

    console.log('Run maintenance anytime with: memark maintain\n');
}

module.exports = { init, getTargetDir };

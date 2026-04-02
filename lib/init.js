const fs = require('fs');
const path = require('path');
const os = require('os');

function getTargetDir(options) {
    if (options.customPath) return path.resolve(options.customPath);
    if (options.global) return path.join(os.homedir(), '.claude', '.memark');
    return path.join(process.cwd(), '.memark');
}

function shouldCopyEntry(entry) {
    if (entry.isDirectory()) return false;
    if (/^example-.*\.md$/i.test(entry.name)) return false;
    return true;
}

function copyTemplates(templatesDir, destDir) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!shouldCopyEntry(entry)) continue;
        const srcPath = path.join(templatesDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (fs.existsSync(destPath)) continue;
        let content = fs.readFileSync(srcPath, 'utf8');
        content = content.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        fs.writeFileSync(destPath, content);
    }
}

function init(options = {}) {
    const targetDir = getTargetDir(options);
    const templatesDir = path.join(__dirname, '..', 'templates');

    if (fs.existsSync(targetDir) && !options.force) {
        const existing = fs.readdirSync(targetDir).filter(f => f.endsWith('.md'));
        if (existing.length > 0) {
            console.error(`\n✗ Memory directory already exists: ${targetDir}`);
            console.error('  Use --force to overwrite, or choose a different location.\n');
            process.exit(1);
        }
    }

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    copyTemplates(templatesDir, targetDir);

    console.log(`\n✓ memark memory initialized in ${targetDir}`);
    console.log('  MEMORY.md             ← Memory index (auto-rebuilt each session)');
    console.log('  AGENT-INSTRUCTIONS.md ← Memory writing protocol');
    console.log('  TEMPLATE.md           ← Template for new memory files');
    console.log('');
}

module.exports = { init, getTargetDir };

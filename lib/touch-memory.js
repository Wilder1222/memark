const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');
const { parseFrontmatter } = require('./rebuild-index');

function updateFrontmatter(content, updates) {
    return content.replace(/^---\n([\s\S]*?)\n---/, (match, fm) => {
        let lines = fm.split('\n');
        for (const [key, value] of Object.entries(updates)) {
            const idx = lines.findIndex(l => l.startsWith(`${key}:`));
            if (idx !== -1) {
                lines[idx] = `${key}: ${value}`;
            } else {
                lines.push(`${key}: ${value}`);
            }
        }
        return `---\n${lines.join('\n')}\n---`;
    });
}

function touchMemory(options = {}) {
    const memoryDir = getTargetDir(options);
    if (!options.file) {
        console.error('\n✗ Missing required option: --file <type/filename.md>\n');
        process.exit(1);
    }

    if (!fs.existsSync(memoryDir)) {
        console.error(`\n✗ Memory directory not found: ${memoryDir}`);
        console.error('  Run: npx agent-memory init\n');
        process.exit(1);
    }

    const normalizedFile = options.file.replace(/\\/g, '/');
    const targetPath = path.resolve(memoryDir, normalizedFile);
    const memoryRoot = path.resolve(memoryDir);

    if (!targetPath.startsWith(memoryRoot)) {
        console.error(`\n✗ File path escapes memory directory: ${options.file}\n`);
        process.exit(1);
    }

    if (!fs.existsSync(targetPath)) {
        console.error(`\n✗ Memory file not found: ${normalizedFile}\n`);
        process.exit(1);
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) {
        console.error(`\n✗ File has no valid frontmatter: ${normalizedFile}\n`);
        process.exit(1);
    }

    const currentAccessCount = parseInt(fm.access_count, 10) || 0;
    const today = new Date().toISOString().split('T')[0];
    const updated = updateFrontmatter(content, {
        last_accessed: today,
        access_count: currentAccessCount + 1,
    });

    fs.writeFileSync(targetPath, updated);
    console.log(`✓ Touched memory: ${normalizedFile} (access_count: ${currentAccessCount + 1}, last_accessed: ${today})`);
}

module.exports = { touchMemory };

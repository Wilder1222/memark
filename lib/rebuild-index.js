const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');

const MAX_INDEX_LINES = 200;
const SKIP_FILES = ['MEMORY.md', 'AGENT-INSTRUCTIONS.md', 'MAINTENANCE.md', 'TEMPLATE.md'];

function parseFrontmatter(content) {
    const normalized = content.replace(/\r\n/g, '\n');
    const match = normalized.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const fm = {};
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        value = value.replace(/\s*#.*$/, '').trim();
        if (key === 'confidence') value = parseFloat(value) || 0;
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, '')).filter(Boolean);
        }
        fm[key] = value;
    }
    return fm;
}

function validateFrontmatter(fm, filename) {
    const errors = [];
    if (!fm.name) errors.push('missing name');
    if (!fm.created) errors.push('missing created');
    if (fm.confidence !== undefined && (typeof fm.confidence !== 'number' || fm.confidence < 0 || fm.confidence > 1)) {
        errors.push(`invalid confidence: ${fm.confidence} (must be 0.0-1.0)`);
    }
    for (const dateField of ['created', 'last_accessed']) {
        if (fm[dateField] && !/^\d{4}-\d{2}-\d{2}$/.test(fm[dateField])) {
            errors.push(`invalid ${dateField}: ${fm[dateField]} (must be YYYY-MM-DD)`);
        }
    }
    return errors;
}

function getFirstLine(content) {
    const afterFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    const lines = afterFrontmatter.split('\n').filter(l => l.trim() && !l.startsWith('**'));
    return lines[0] ? lines[0].slice(0, 80) : '(no description)';
}

function scanMemories(memDir) {
    const entries = [];
    const validationWarnings = [];
    if (!fs.existsSync(memDir)) return { entries, validationWarnings };

    const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md') && !SKIP_FILES.includes(f));
    for (const file of files) {
        const filePath = path.join(memDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        if (!fm) {
            validationWarnings.push(`  ⚠ ${file}: no valid frontmatter`);
            continue;
        }

        const errors = validateFrontmatter(fm, file);
        if (errors.length > 0) {
            validationWarnings.push(`  ⚠ ${file}: ${errors.join('; ')}`);
        }

        entries.push({
            name: fm.name || file.replace('.md', ''),
            file,
            summary: getFirstLine(content),
            confidence: typeof fm.confidence === 'number' ? fm.confidence : parseFloat(fm.confidence) || 0.5,
        });
    }
    entries.sort((a, b) => b.confidence - a.confidence);
    return { entries, validationWarnings };
}

function buildIndexOutput({ today, entries, totalCount, prunedCount }) {
    const lines = [];
    lines.push('# Memory Index');
    lines.push('');
    lines.push(`_Last updated: ${today} | Indexed: ${entries.length} of ${totalCount} memories_`);
    lines.push('');
    lines.push('> **Agent Instructions:**');
    lines.push('> 1. This index is auto-loaded at session start via hooks');
    lines.push('> 2. Match relevant entries based on current task keywords and context');
    lines.push('> 3. Only load specific memory files relevant to the current task');
    lines.push('> 4. After changing memory files, run `node ./.memark/bin/cli.js rebuild-index`');
    lines.push('> 5. Full protocol: see `AGENT-INSTRUCTIONS.md`');
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Memories');
    lines.push('');
    if (entries.length === 0) {
        lines.push('(no memories yet)');
    } else {
        for (const e of entries) {
            lines.push(`- [${e.name}](${e.file}) — ${e.summary} [confidence: ${e.confidence.toFixed(2)}]`);
        }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Notes');
    lines.push('');
    lines.push(`- Index line limit: ${MAX_INDEX_LINES} lines (lowest-confidence entries pruned from index view)`);
    if (prunedCount > 0) lines.push(`- Pruned from index this run: ${prunedCount}`);
    lines.push('- Run `node ./.memark/bin/cli.js maintain` for decay/cleanup');
    lines.push('');

    return lines.join('\n');
}

function enforceLineCap({ today, entries, totalCount }) {
    const mutable = [...entries];
    const pruned = [];

    let output = buildIndexOutput({ today, entries: mutable, totalCount, prunedCount: 0 });

    while (output.split('\n').length > MAX_INDEX_LINES && mutable.length > 0) {
        const removed = mutable.pop();
        pruned.push(removed);
        output = buildIndexOutput({ today, entries: mutable, totalCount, prunedCount: pruned.length });
    }

    return { output, indexedCount: mutable.length, prunedEntries: pruned };
}

function rebuildIndex(options = {}) {
    const memDir = getTargetDir(options);

    if (!fs.existsSync(memDir)) {
        console.error(`\n✗ Memory directory not found: ${memDir}`);
        console.error('  Run: npx memark install\n');
        process.exit(1);
    }

    const { entries, validationWarnings } = scanMemories(memDir);
    const today = new Date().toISOString().split('T')[0];
    const indexPath = path.join(memDir, 'MEMORY.md');

    const capResult = enforceLineCap({ today, entries, totalCount: entries.length });

    if (validationWarnings.length > 0) {
        console.warn('\n⚠ Validation warnings:');
        for (const warning of validationWarnings) {
            console.warn(warning);
        }
    }

    if (capResult.prunedEntries.length > 0) {
        console.warn(`\n⚠ Index pruning applied: ${capResult.prunedEntries.length} low-confidence entries omitted from index to enforce ${MAX_INDEX_LINES}-line cap.`);
    }

    fs.writeFileSync(indexPath, capResult.output);
    console.log(`✓ Index rebuilt: indexed ${capResult.indexedCount}/${entries.length} memories (${capResult.output.split('\n').length} lines)`);
    return capResult.indexedCount;
}

module.exports = { rebuildIndex, parseFrontmatter, validateFrontmatter };

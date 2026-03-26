const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');

const VALID_TYPES = ['user', 'project', 'pattern', 'feedback'];
const MAX_INDEX_LINES = 200;
const SECTION_ORDER = ['user', 'project', 'patterns', 'feedback'];

function parseFrontmatter(content) {
    // Normalize CRLF to LF before parsing
    const normalized = content.replace(/\r\n/g, '\n');
    const match = normalized.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const fm = {};
    for (const line of match[1].split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        // Remove inline comments
        value = value.replace(/\s*#.*$/, '').trim();
        // Parse confidence as float
        if (key === 'confidence') value = parseFloat(value) || 0;
        // Parse arrays
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, '')).filter(Boolean);
        }
        fm[key] = value;
    }
    return fm;
}

function validateFrontmatter(fm, filename) {
    const errors = [];

    // Check required fields
    if (!fm.name) errors.push('missing name');
    if (!fm.type) errors.push('missing type');
    if (!fm.created) errors.push('missing created');

    // Check type validity
    if (fm.type && !VALID_TYPES.includes(fm.type)) errors.push(`invalid type: ${fm.type} (must be one of: ${VALID_TYPES.join(', ')})`);

    // Check confidence range
    if (fm.confidence !== undefined && (typeof fm.confidence !== 'number' || fm.confidence < 0 || fm.confidence > 1)) {
        errors.push(`invalid confidence: ${fm.confidence} (must be 0.0-1.0)`);
    }

    // Check date formats
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

function scanDir(dir, type) {
    const entries = [];
    const validationWarnings = [];
    if (!fs.existsSync(dir)) return { entries, validationWarnings };
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== '.gitkeep');
    for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        if (!fm) {
            validationWarnings.push(`  ⚠ ${type}/${file}: no valid frontmatter`);
            continue;
        }

        const errors = validateFrontmatter(fm, file);
        if (errors.length > 0) {
            validationWarnings.push(`  ⚠ ${type}/${file}: ${errors.join('; ')}`);
        }

        entries.push({
            name: fm.name || file.replace('.md', ''),
            file: `${type}/${file}`,
            summary: getFirstLine(content),
            confidence: typeof fm.confidence === 'number' ? fm.confidence : parseFloat(fm.confidence) || 0.5,
        });
    }
    // Sort by confidence descending
    entries.sort((a, b) => b.confidence - a.confidence);
    return { entries, validationWarnings };
}

function buildSection(title, description, entries) {
    const lines = [];
    lines.push(`## ${title}`);
    lines.push(`_${description}_`);
    lines.push('');
    lines.push(`<!-- Format: - [Memory Name](type/file.md) — one-line summary [confidence: X.X] -->`);
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
    return lines;
}

function buildIndexOutput({ today, indexedCount, totalCount, sections, prunedCount }) {
    const lines = [];
    lines.push('# Memory Index');
    lines.push('');
    lines.push(`_Last updated: ${today} | Indexed: ${indexedCount} of ${totalCount} memories_`);
    lines.push('');
    lines.push('> **Agent Instructions:**');
    lines.push('> 1. Read this file at the start of every session to understand available memories');
    lines.push('> 2. Match relevant memory entries based on current task keywords and context');
    lines.push('> 3. Only load specific memory files relevant to the current task (avoid loading all)');
    lines.push('> 4. Tags live in each memory file\'s frontmatter, not in this index');
    lines.push('> 5. After changing memory files, run `npx agent-memory rebuild-index`');
    lines.push('> 6. Full operation protocol: see `AGENT-INSTRUCTIONS.md`');
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(...buildSection('User', 'User preferences, habits, background information', sections.user));
    lines.push(...buildSection('Project', 'Project decisions, context, progress, tech choices', sections.project));
    lines.push(...buildSection('Patterns', 'Distilled work patterns, best practices, recurring solutions', sections.patterns));
    lines.push(...buildSection('Feedback', 'User corrections or confirmations of Agent behavior', sections.feedback));

    lines.push('## Maintenance Notes');
    lines.push('');
    lines.push(`- Index line limit is enforced at ${MAX_INDEX_LINES} lines by pruning lowest-confidence entries from the index view`);
    lines.push('- Prune order: lowest confidence first; ties resolved by section order user -> project -> patterns -> feedback');
    lines.push(`- Pruned from index this run: ${prunedCount}`);
    lines.push('- Full maintenance protocol: see `MAINTENANCE.md`');
    lines.push('- Run `npx agent-memory maintain` manually when you want decay/archive behavior');
    lines.push('');

    return lines.join('\n');
}

function choosePruneCandidate(sections) {
    let candidate = null;

    for (const sectionName of SECTION_ORDER) {
        const entries = sections[sectionName];
        if (!entries || entries.length === 0) continue;

        const entry = entries[entries.length - 1];
        if (!candidate) {
            candidate = { sectionName, entry };
            continue;
        }

        if (entry.confidence < candidate.entry.confidence) {
            candidate = { sectionName, entry };
        }
    }

    return candidate;
}

function enforceLineCap({ today, sections, totalCount }) {
    const mutableSections = {
        user: [...sections.user],
        project: [...sections.project],
        patterns: [...sections.patterns],
        feedback: [...sections.feedback],
    };

    const prunedEntries = [];
    let output = buildIndexOutput({
        today,
        indexedCount: mutableSections.user.length + mutableSections.project.length + mutableSections.patterns.length + mutableSections.feedback.length,
        totalCount,
        sections: mutableSections,
        prunedCount: prunedEntries.length,
    });

    while (output.split('\n').length > MAX_INDEX_LINES) {
        const candidate = choosePruneCandidate(mutableSections);
        if (!candidate) break;

        const removed = mutableSections[candidate.sectionName].pop();
        prunedEntries.push({ section: candidate.sectionName, file: removed.file, confidence: removed.confidence });

        output = buildIndexOutput({
            today,
            indexedCount: mutableSections.user.length + mutableSections.project.length + mutableSections.patterns.length + mutableSections.feedback.length,
            totalCount,
            sections: mutableSections,
            prunedCount: prunedEntries.length,
        });
    }

    return {
        output,
        sections: mutableSections,
        prunedEntries,
        indexedCount: mutableSections.user.length + mutableSections.project.length + mutableSections.patterns.length + mutableSections.feedback.length,
    };
}

function rebuildIndex(options = {}) {
    const memoryDir = getTargetDir(options);

    if (!fs.existsSync(memoryDir)) {
        console.error(`\n✗ Memory directory not found: ${memoryDir}`);
        console.error('  Run: npx agent-memory init\n');
        process.exit(1);
    }

    const userResult = scanDir(path.join(memoryDir, 'user'), 'user');
    const projectResult = scanDir(path.join(memoryDir, 'project'), 'project');
    const patternsResult = scanDir(path.join(memoryDir, 'patterns'), 'patterns');
    const feedbackResult = scanDir(path.join(memoryDir, 'feedback'), 'feedback');

    const user = userResult.entries;
    const project = projectResult.entries;
    const patterns = patternsResult.entries;
    const feedback = feedbackResult.entries;

    const allWarnings = [
        ...userResult.validationWarnings,
        ...projectResult.validationWarnings,
        ...patternsResult.validationWarnings,
        ...feedbackResult.validationWarnings,
    ];

    const total = user.length + project.length + patterns.length + feedback.length;
    const today = new Date().toISOString().split('T')[0];

    const indexPath = path.join(memoryDir, 'MEMORY.md');

    const capResult = enforceLineCap({
        today,
        totalCount: total,
        sections: { user, project, patterns, feedback },
    });

    const output = capResult.output;

    if (allWarnings.length > 0) {
        console.warn('\n⚠ Validation warnings:');
        for (const warning of allWarnings) {
            console.warn(warning);
        }
    }

    if (capResult.prunedEntries.length > 0) {
        console.warn(`\n⚠ Index pruning applied: ${capResult.prunedEntries.length} low-confidence entries omitted from index to enforce ${MAX_INDEX_LINES}-line cap.`);
    }

    fs.writeFileSync(indexPath, output);
    console.log(`✓ Index rebuilt: indexed ${capResult.indexedCount}/${total} memories (${output.split('\n').length} lines)`);
    return capResult.indexedCount;
}

module.exports = { rebuildIndex, parseFrontmatter, validateFrontmatter };

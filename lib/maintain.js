const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');
const { parseFrontmatter, rebuildIndex, validateFrontmatter } = require('./rebuild-index');

const SKIP_FILES = ['MEMORY.md', 'AGENT-INSTRUCTIONS.md', 'MAINTENANCE.md', 'TEMPLATE.md'];

function daysSince(dateStr) {
    if (!dateStr) return 999;
    const d = new Date(dateStr);
    if (isNaN(d)) return 999;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

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

function maintain(options = {}) {
    const memDir = getTargetDir(options);

    if (!fs.existsSync(memDir)) {
        console.error(`\n✗ Memory directory not found: ${memDir}`);
        console.error('  Run: npx memark install\n');
        process.exit(1);
    }

    const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md') && !SKIP_FILES.includes(f));

    let decayed = 0;
    let removed = 0;
    const validationWarnings = [];

    console.log('\nRunning memory maintenance...\n');

    for (const file of files) {
        const filePath = path.join(memDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        const fm = parseFrontmatter(content);
        if (!fm) {
            validationWarnings.push(`  ⚠ ${file}: no valid frontmatter`);
            continue;
        }

        const errors = validateFrontmatter(fm, file);
        if (errors.length > 0) {
            validationWarnings.push(`  ⚠ ${file}: ${errors.join('; ')}`);
        }

        const days = daysSince(fm.last_accessed);
        let confidence = typeof fm.confidence === 'number' ? fm.confidence : parseFloat(fm.confidence) || 0.5;

        // Confidence decay by 30-day buckets
        const decaySteps = Math.floor(days / 30);
        if (decaySteps > 0) {
            const oldConfidence = confidence;
            const newConfidence = Math.round(confidence * Math.pow(0.8, decaySteps) * 100) / 100;
            content = updateFrontmatter(content, { confidence: newConfidence });
            fs.writeFileSync(filePath, content);
            confidence = newConfidence;
            decayed++;
            console.log(`  ↓ Decayed: ${file} (${oldConfidence.toFixed(2)} → ${newConfidence.toFixed(2)}, ${days} days idle, ${decaySteps} steps)`);
        }

        // Remove if below threshold
        if (confidence < 0.2) {
            fs.unlinkSync(filePath);
            console.log(`  ✗ Removed (low confidence): ${file}`);
            removed++;
        }
    }

    console.log('');

    if (validationWarnings.length > 0) {
        console.warn('⚠ Validation warnings:');
        for (const warning of validationWarnings) {
            console.warn(warning);
        }
    }

    rebuildIndex(options);

    console.log(`\n✓ Maintenance complete`);
    console.log(`  Decayed: ${decayed} memories`);
    console.log(`  Removed: ${removed} memories\n`);
}

module.exports = { maintain };

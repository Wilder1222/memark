const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');
const { parseFrontmatter, rebuildIndex, validateFrontmatter } = require('./rebuild-index');

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

function ensureArchiveLog(archiveDir) {
    const logPath = path.join(archiveDir, 'ARCHIVE-LOG.md');
    if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '# Archive Log\n\n| Date | File | Reason | Confidence at Archive |\n|------|------|--------|----------------------|\n');
    }
    return logPath;
}

function appendArchiveLog(logPath, filename, reason, confidence) {
    const today = new Date().toISOString().split('T')[0];
    const entry = `| ${today} | ${filename} | ${reason} | ${confidence.toFixed(2)} |\n`;
    fs.appendFileSync(logPath, entry);
}

function maintain(options = {}) {
    const memoryDir = getTargetDir(options);

    if (!fs.existsSync(memoryDir)) {
        console.error(`\n✗ Memory directory not found: ${memoryDir}`);
        console.error('  Run: memark init\n');
        process.exit(1);
    }

    const archiveDir = path.join(memoryDir, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const archiveLogPath = ensureArchiveLog(archiveDir);

    const categories = ['user', 'project', 'patterns', 'feedback'];

    let decayed = 0;
    let archived = 0;
    const validationWarnings = [];

    console.log('\nRunning memory maintenance...\n');

    for (const category of categories) {
        const categoryDir = path.join(memoryDir, category);
        if (!fs.existsSync(categoryDir)) continue;

        const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.md') && f !== '.gitkeep');

        for (const file of files) {
            const filePath = path.join(categoryDir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            const fm = parseFrontmatter(content);
            if (!fm) {
                validationWarnings.push(`  ⚠ ${category}/${file}: no valid frontmatter`);
                continue;
            }

            const errors = validateFrontmatter(fm, file);
            if (errors.length > 0) {
                validationWarnings.push(`  ⚠ ${category}/${file}: ${errors.join('; ')}`);
            }

            const days = daysSince(fm.last_accessed);
            let confidence = typeof fm.confidence === 'number' ? fm.confidence : parseFloat(fm.confidence) || 0.5;

            // TTL check
            const ttl = fm.ttl && fm.ttl !== 'null' ? parseInt(fm.ttl) : null;
            if (ttl && days > ttl) {
                const timestamp = new Date().toISOString().split('T')[0];
                const destPath = path.join(archiveDir, `${category}_${timestamp}_${file}`);
                fs.renameSync(filePath, destPath);
                appendArchiveLog(archiveLogPath, `${category}/${file}`, `TTL exceeded (${days} days > ${ttl})`, confidence);
                console.log(`  → Archived (TTL): ${category}/${file}`);
                archived++;
                continue;
            }

            // Confidence decay by 30-day buckets
            const decaySteps = Math.floor(days / 30);
            if (decaySteps > 0) {
                const oldConfidence = confidence;
                const newConfidence = Math.round(confidence * Math.pow(0.8, decaySteps) * 100) / 100;
                content = updateFrontmatter(content, { confidence: newConfidence });
                fs.writeFileSync(filePath, content);
                confidence = newConfidence;
                decayed++;
                console.log(`  ↓ Decayed: ${category}/${file} (${oldConfidence.toFixed(2)} → ${newConfidence.toFixed(2)}, ${days} days idle, ${decaySteps} steps)`);
            }

            // Archive if below threshold
            if (confidence < 0.2) {
                const timestamp = new Date().toISOString().split('T')[0];
                const destPath = path.join(archiveDir, `${category}_${timestamp}_${file}`);
                fs.renameSync(filePath, destPath);
                appendArchiveLog(archiveLogPath, `${category}/${file}`, `confidence < 0.2`, confidence);
                console.log(`  → Archived (low confidence): ${category}/${file}`);
                archived++;
            }
        }
    }

    // Rebuild index after applying the current maintenance rules.
    console.log('');

    if (validationWarnings.length > 0) {
        console.warn('⚠ Validation warnings:');
        for (const warning of validationWarnings) {
            console.warn(warning);
        }
    }

    rebuildIndex(options);

    console.log(`\n✓ Maintenance complete`);
    console.log(`  Decayed:  ${decayed} memories`);
    console.log(`  Archived: ${archived} memories`);
    console.log(`  Archive log: ${archiveLogPath}\n`);
}

module.exports = { maintain };

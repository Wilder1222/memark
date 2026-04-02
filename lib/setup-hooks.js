const fs = require('fs');
const path = require('path');

const MEMARK_HOOK_TAG = '__memark_managed';

function getMemarkHooks(projectRoot) {
    const memarkBin = 'node ./.memark/bin/cli.js';
    const memoryIndex = './memory/MEMORY.md';
    const agentInstructions = './memory/AGENT-INSTRUCTIONS.md';

    return {
        SessionStart: [
            {
                matcher: 'startup|resume|clear|compact',
                hooks: [
                    {
                        type: 'command',
                        command: `${memarkBin} rebuild-index 1>&2 && echo "--- memark memory index ---" 1>&2 && cat ${memoryIndex} 1>&2 && echo "--- end memark memory ---" 1>&2`
                    }
                ],
                [MEMARK_HOOK_TAG]: true
            }
        ],
        SessionEnd: [
            {
                hooks: [
                    {
                        type: 'command',
                        command: `${memarkBin} session-end --threshold 10`
                    }
                ],
                [MEMARK_HOOK_TAG]: true
            }
        ]
    };
}

function mergeHooks(existing, memarkHooks) {
    const merged = { ...existing };

    for (const [event, entries] of Object.entries(memarkHooks)) {
        if (!merged[event]) {
            merged[event] = entries;
            continue;
        }

        // Remove old memark-managed entries
        const filtered = merged[event].filter(e => !e[MEMARK_HOOK_TAG]);
        merged[event] = [...filtered, ...entries];
    }

    return merged;
}

function setupHooks(projectRoot) {
    projectRoot = projectRoot || process.cwd();
    const claudeDir = path.join(projectRoot, '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
    }

    let settings = {};
    if (fs.existsSync(settingsPath)) {
        try {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch {
            // If settings.json is corrupt, start fresh but warn
            console.warn('  Warning: existing .claude/settings.json was invalid, creating new one');
            settings = {};
        }
    }

    const memarkHooks = getMemarkHooks(projectRoot);
    settings.hooks = mergeHooks(settings.hooks || {}, memarkHooks);

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

    return { settingsPath };
}

module.exports = { setupHooks, MEMARK_HOOK_TAG };

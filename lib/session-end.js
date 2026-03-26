const fs = require('fs');
const path = require('path');
const { getTargetDir } = require('./init');
const { rebuildIndex } = require('./rebuild-index');
const { maintain } = require('./maintain');

const DEFAULT_THRESHOLD = 10;

function getStatePath(memoryDir) {
    return path.join(memoryDir, '.maintenance-state.json');
}

function readState(memoryDir) {
    const statePath = getStatePath(memoryDir);
    if (!fs.existsSync(statePath)) {
        return { maintenanceCount: 0 };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return {
            maintenanceCount: Number.isInteger(parsed.maintenanceCount) ? parsed.maintenanceCount : 0,
            lastSessionEnd: parsed.lastSessionEnd || null,
        };
    } catch {
        return { maintenanceCount: 0 };
    }
}

function writeState(memoryDir, state) {
    const statePath = getStatePath(memoryDir);
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function sessionEnd(options = {}) {
    const memoryDir = getTargetDir(options);
    if (!fs.existsSync(memoryDir)) {
        console.error(`\n✗ Memory directory not found: ${memoryDir}`);
        console.error('  Run: npx agent-memory init\n');
        process.exit(1);
    }

    const threshold = Number.isInteger(options.threshold) && options.threshold > 0 ? options.threshold : DEFAULT_THRESHOLD;
    const state = readState(memoryDir);
    const today = new Date().toISOString().split('T')[0];

    state.maintenanceCount = (state.maintenanceCount || 0) + 1;
    state.lastSessionEnd = today;

    console.log(`\nSession end recorded (count: ${state.maintenanceCount}/${threshold}).`);

    if (state.maintenanceCount >= threshold) {
        console.log('Threshold reached. Running full maintenance...');
        maintain(options);
        state.maintenanceCount = 0;
        console.log('Maintenance counter reset to 0.');
    } else {
        rebuildIndex(options);
    }

    writeState(memoryDir, state);
    console.log(`State saved: ${path.basename(getStatePath(memoryDir))}\n`);
}

module.exports = { sessionEnd };

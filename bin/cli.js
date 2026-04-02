#!/usr/bin/env node

const { init } = require('../lib/init');
const { install } = require('../lib/install');
const { maintain } = require('../lib/maintain');
const { touchMemory } = require('../lib/touch-memory');
const { sessionEnd } = require('../lib/session-end');
const { setupHooks } = require('../lib/setup-hooks');

const args = process.argv.slice(2);
const firstArg = args[0];
const command = !firstArg || firstArg.startsWith('-') ? 'install' : firstArg;
const flags = !firstArg || firstArg.startsWith('-') ? args : args.slice(1);
const wantsHelp = firstArg === '--help' || firstArg === '-h' || flags.includes('--help') || flags.includes('-h');

const help = `
memark — Local memory system for Claude CLI and Codex CLI

USAGE:
  npx github:Wilder1222/memark
  npx github:Wilder1222/memark install [--force]

PUBLIC COMMANDS:
  install           Install memark runtime into ./.memark, init memory, configure hooks, and update CLAUDE.md
  setup-hooks       Configure Claude Code hooks in .claude/settings.json (without full reinstall)

OPTIONS:
  --force           Overwrite existing memory directory
  --help, -h        Show this help

EXAMPLES:
  npx github:Wilder1222/memark
  npx github:Wilder1222/memark install
  npx github:Wilder1222/memark install --force
`;

if (wantsHelp) {
    console.log(help);
    process.exit(0);
}

const isGlobal = flags.includes('--global');
const isForce = flags.includes('--force');
const pathIdx = flags.indexOf('--path');
const customPath = pathIdx !== -1 ? flags[pathIdx + 1] : null;
const fileIdx = flags.indexOf('--file');
const fileArg = fileIdx !== -1 ? flags[fileIdx + 1] : null;
const thresholdIdx = flags.indexOf('--threshold');
const thresholdArg = thresholdIdx !== -1 ? parseInt(flags[thresholdIdx + 1], 10) : null;

switch (command) {
    case 'install':
        install({ force: isForce });
        break;
    case 'init':
        init({ global: isGlobal, force: isForce, customPath });
        break;
    case 'maintain':
        maintain({ global: isGlobal, customPath });
        break;
    case 'rebuild-index': {
        const { rebuildIndex } = require('../lib/rebuild-index');
        rebuildIndex({ global: isGlobal, customPath });
        break;
    }
    case 'touch-memory':
        touchMemory({ global: isGlobal, customPath, file: fileArg });
        break;
    case 'session-end':
        sessionEnd({ global: isGlobal, customPath, threshold: thresholdArg });
        break;
    case 'setup-hooks':
        setupHooks();
        console.log('✓ Claude Code hooks configured in .claude/settings.json');
        break;
    default:
        console.error(`Unknown command: ${command}`);
        console.log('Run with --help to see available commands.');
        process.exit(1);
}

#!/usr/bin/env node

const { init } = require('../lib/init');
const { maintain } = require('../lib/maintain');
const { touchMemory } = require('../lib/touch-memory');
const { sessionEnd } = require('../lib/session-end');

const args = process.argv.slice(2);
const command = args[0];
const flags = args.slice(1);
const wantsHelp = !command || command === '--help' || command === '-h' || flags.includes('--help') || flags.includes('-h');

const help = `
agent-memory — Local Markdown memory system for AI agents

USAGE:
  npx agent-memory <command> [options]

COMMANDS:
  init              Initialize memory system in ./memory/
  init --global     Initialize in ~/.claude/memory/ (global agent memory)
  maintain          Run manual maintenance (TTL archive, decay, rebuild index)
  rebuild-index     Rebuild MEMORY.md index from existing memory files only
  touch-memory      Update last_accessed and access_count for one memory file
  session-end       Increment maintenance counter and optionally trigger maintain

OPTIONS:
  --global          Use global memory directory (~/.claude/memory/)
  --path <dir>      Use custom memory directory
  --file <path>     Memory file relative to memory root (for touch-memory)
  --threshold <n>   Session count threshold to auto-run maintain (session-end)
  --force           Overwrite existing memory directory
  --help, -h        Show this help

EXAMPLES:
  npx agent-memory init                    # project-level memory
  npx agent-memory init --global           # global agent memory
  npx agent-memory maintain                # run maintenance on ./memory/
  npx agent-memory maintain --global       # run maintenance on global memory
  npx agent-memory rebuild-index --path ./custom/memory
  npx agent-memory touch-memory --file user/my-preference.md
  npx agent-memory session-end --threshold 10
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
    default:
        console.error(`Unknown command: ${command}`);
        console.log('Run with --help to see available commands.');
        process.exit(1);
}

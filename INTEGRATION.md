# Agent Integration Guide — Quick Reference

Integrate `agent-memory` into your AI agent workflow for cross-session persistent memory.

## Session Lifecycle

Add these commands to your agent's workflow:

### 1. Session Start
```bash
npx agent-memory rebuild-index
```
Then read:
- `memory/MEMORY.md` (dynamic index)
- `memory/AGENT-INSTRUCTIONS.md` (protocol)

### 2. After Reading Memory
```bash
npx agent-memory touch-memory --file memory/<type>/<name>.md
```
Updates `last_accessed` and `access_count`.

### 3. Session End
```bash
npx agent-memory session-end
```
Auto-triggers full maintenance every 10 sessions (customizable: `--threshold 5`).

### 4. Emergency Maintenance
```bash
npx agent-memory maintain
```
Run full TTL→decay→archive pass manually if needed.

## Node.js Example

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

class MemoryAgent {
  initSession() {
    execSync('npx agent-memory rebuild-index', { stdio: 'inherit' });
    const memory = fs.readFileSync('memory/MEMORY.md', 'utf8');
    return memory;
  }

  readMemory(path) {
    execSync(`npx agent-memory touch-memory --file ${path}`, { stdio: 'inherit' });
    return fs.readFileSync(path, 'utf8');
  }

  endSession() {
    execSync('npx agent-memory session-end', { stdio: 'inherit' });
  }
}

const agent = new MemoryAgent();
agent.initSession();
// ... work with memories ...
agent.endSession();
```

## Python Example

```python
import subprocess
from pathlib import Path

class MemoryAgent:
    def init_session(self):
        subprocess.run(['npx', 'agent-memory', 'rebuild-index'], check=True)
        return Path('memory/MEMORY.md').read_text()
    
    def read_memory(self, path):
        subprocess.run(['npx', 'agent-memory', 'touch-memory', '--file', path], check=True)
        return Path(path).read_text()
    
    def end_session(self):
        subprocess.run(['npx', 'agent-memory', 'session-end'], check=True)

agent = MemoryAgent()
agent.init_session()
# ... work with memories ...
agent.end_session()
```

## VS Code / Claude Code Integration

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Rebuild memory",
      "type": "shell",
      "command": "npx agent-memory rebuild-index"
    }
  ]
}
```

Or in your `CLAUDE.md`:

```markdown
# Session Init
- Run: `npx agent-memory rebuild-index`
- Read: `memory/MEMORY.md` and `memory/AGENT-INSTRUCTIONS.md`

# Session End
- Run: `npx agent-memory session-end`
```

## Memory File Format

Each memory file must have YAML frontmatter:

```markdown
---
name: Example Memory
type: user                    # user | project | pattern | feedback
created: 2025-01-20
last_accessed: 2025-01-20
access_count: 1
confidence: 0.9              # 0.0-1.0 (required)
tags: [example, test]
ttl: null                    # null (permanent) or days
related: []
---

# Content

Your memory content here...
```

## More Information

- See **README.md** for full command reference
- See **spec.md** for v1 contract details
- See **templates/** for example memory files

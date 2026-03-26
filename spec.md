# Agent 本地记忆系统 — Spec

## Problem

AI Agent（Claude Code 等）在跨会话工作时缺乏持久记忆，每次启动都从零开始，无法积累用户偏好、项目决策、工作规律。现有方案存在两大核心问题：**检索失败**（记忆太多太杂）和**记忆腐烂**（过时信息误导 Agent）。

需要一套**可发布、可复用**的本地记忆系统，通过 `npx` 一键安装到任何项目或全局 Agent 环境中。

## Goals

- `npx <pkg> init` 在当前目录初始化项目级记忆
- `npx <pkg> init --global` 安装到 `~/.claude/memory/` 全局记忆
- `npx <pkg> rebuild-index` 从现有记忆文件重建 `MEMORY.md`
- `npx <pkg> maintain` 手动执行一次维护流程
- Agent 能通过 `MEMORY.md` 快速定位相关记忆（检索效率）
- 人类可直接阅读编辑所有 MD 文件

## Non-Goals (YAGNI)

- 不构建数据库或向量检索（纯 MD 文件）
- 不构建 Web UI
- 不做云同步（本地优先）
- 不支持多用户协作
- v1 不实现无命令触发的后台自动 session hook
- v1 不实现自动模式提炼或自动去重

## Proposed Solution

**npx CLI + 纯 Markdown 记忆系统**

项目发布为 npm 包，提供 CLI 工具执行初始化、索引重建和手动维护。安装后生成标准目录结构：每条记忆是独立 `.md` 文件，带 frontmatter（tags/type/confidence/TTL）；`MEMORY.md` 作动态索引；Agent 读取 `AGENT-INSTRUCTIONS.md` 了解建议工作流。

## 目录结构（安装后生成）

```
memory/                        # 项目级：./<project>/memory/
                               # 全局级：~/.claude/memory/
├── MEMORY.md                  # 动态索引（Agent 每次必读）
├── AGENT-INSTRUCTIONS.md      # Agent 操作手册
├── MAINTENANCE.md             # 维护协议
├── TEMPLATE.md                # 记忆文件模板
├── user/                      # 用户偏好、习惯
├── project/                   # 项目决策、上下文
├── patterns/                  # 提炼的工作规律
├── feedback/                  # 行为纠正/确认
└── archive/                   # 低置信度归档
```

## 记忆文件格式

```markdown
---
name: 记忆名称
type: user | project | pattern | feedback
tags: [tag1, tag2]
confidence: 0.9
created: 2026-03-25
last_accessed: 2026-03-25
access_count: 1
ttl: 90
related: []
---

记忆内容

**Why:** 背景原因
**How to apply:** 何时使用
```

## v1 命令契约

1. `init`
    - 初始化 memory 目录结构
    - 复制模板文件，但不复制仓库内置的示例记忆文件
    - 目标目录非空时默认失败，除非显式传入 `--force`

2. `rebuild-index`
    - 扫描 `user/`、`project/`、`patterns/`、`feedback/`
    - 解析 frontmatter
    - 重写 `MEMORY.md`
    - 强制 `MEMORY.md` 总行数 ≤ 200，超限时按最低 confidence 优先从索引中裁剪条目
    - 裁剪并不删除原始记忆文件，仅影响索引可见性

3. `maintain`
    - 对超过 `ttl` 天数的记忆执行归档（基于 `last_accessed` 和 `ttl` 字段）
    - 对 `last_accessed` 超过 30 天的记忆按时间片衰减：`confidence × 0.8^k`，其中 `k=floor(days/30)`
    - 对 `confidence < 0.2` 的记忆执行归档
    - 验证所有 frontmatter 字段，对无效字段发出警告
    - 最后调用 `rebuild-index`

4. `touch-memory`
    - 输入 `--file <type/filename.md>`
    - 更新目标文件 `last_accessed = today`
    - `access_count` 自增 1

5. `session-end`
    - 记录一次 session 结束并更新 `.maintenance-state.json`
    - 默认阈值为 10，可通过 `--threshold <n>` 调整
    - 未达阈值时执行 `rebuild-index`
    - 达到阈值时执行 `maintain` 并将计数重置

## Agent 自动化流程（推荐）

1. 会话开始：执行 `rebuild-index`，读取 `MEMORY.md`，加载相关记忆文件
2. 会话中：每次读取记忆文件后执行 `touch-memory --file <type/file.md>`
3. 会话结束：写入新记忆后执行 `session-end`（自动计数并按阈值触发维护）
4. 手动维护：用户或 Agent 显式触发 `maintain`

该流程不依赖后台守护进程，通过显式命令调用完成自动化闭环。

## Acceptance Criteria

- [ ] `npx <pkg> init` 生成完整目录结构，不包含示例记忆文件
- [ ] `npx <pkg> init --global` 安装到 `~/.claude/memory/`
- [ ] `npx <pkg> rebuild-index` 能从现有记忆文件生成 `MEMORY.md`，并验证 frontmatter
- [ ] `npx <pkg> maintain` 行为与文档中的 v1 契约一致
- [ ] `npx <pkg> touch-memory --file ...` 能更新访问元数据
- [ ] `npx <pkg> session-end` 能维护计数并按阈值触发 `maintain`
- [ ] `MEMORY.md` 在任何情况下都不会超过 200 行
- [ ] 所有记忆文件有完整 frontmatter，无效 frontmatter 会被标记
- [ ] `type` 必须是 user / project / pattern / feedback 之一
- [ ] `confidence` 必须是 0.0-1.0 之间的数字
- [ ] 日期字段必须遵循 YYYY-MM-DD 格式
- [ ] `ttl` 表示生命周期上限（天数），超过则直接归档，设为 null 表示永久保留
- [ ] AGENT-INSTRUCTIONS.md 覆盖完整操作流程
- [ ] 包可发布到 npm（package.json 配置正确）

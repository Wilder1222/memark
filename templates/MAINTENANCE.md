# Memory Maintenance Protocol

This document defines the current manual maintenance behavior implemented by the CLI.

---

## Trigger Conditions

| Trigger | When | What to run |
|---------|------|-------------|
| File edits | After creating/updating memory files | `node ./.memark/bin/cli.js rebuild-index` |
| Manual | Whenever the user or agent chooses | `node ./.memark/bin/cli.js maintain` |
| Session wrap-up | End of each work session | `node ./.memark/bin/cli.js session-end` |

---

## Index Refresh

Run after creating or editing memory files:

1. Ensure memory files contain valid frontmatter
2. Run `node ./.memark/bin/cli.js rebuild-index`
3. Review `MEMORY.md` for stale summaries or broken links

**Completion check:** `MEMORY.md` reflects current state.

## Manual Maintenance Pass

Run `node ./.memark/bin/cli.js maintain` when you want the CLI to apply its current maintenance rules.

### Phase 1: TTL Archival

For each memory file in `user/`, `project/`, `patterns/`, `feedback/`:

1. Read `last_accessed` date and `ttl` field
2. Calculate days since last access: `days = today - last_accessed`
3. If `ttl` is set and `days > ttl`: move file directly to `archive/`
   - This is a hard deadline based on the memory's age
   - Log the archival with the reason and confidence at archive time

**Example:** If `ttl: 90` and `last_accessed: 2026-01-01`, and today is 2026-04-02 (91 days later), the file is archived immediately.

### Phase 2: Confidence Decay

For each remaining memory file:

1. Compute `k = floor(days_since_last_accessed / 30)`
2. If `k >= 1`, apply bucketed decay:
   ```
   new_confidence = current_confidence × 0.8^k
   ```
3. Update the file's `confidence` field

**Important:** This guarantees consistent decay even when maintenance is not run every 30 days exactly.

### Phase 3: Archive Low-Confidence Memories

For each remaining memory file:

1. If `confidence < 0.2`: move file to `archive/`
2. Add a note in `archive/ARCHIVE-LOG.md`:
   ```
   | date | filename | reason | confidence_at_archive |
   ```

**Rationale:** Memories below 0.2 confidence are likely outdated or irrelevant. Archive (not delete) for human review.

### Phase 4: Rebuild Index

After all modifications:

1. Scan all files in `user/`, `project/`, `patterns/`, `feedback/` (excluding `archive/`)
2. Parse and validate frontmatter from each file:
   - `type` must be one of: user, project, pattern, feedback
   - `confidence` must be a number between 0.0 and 1.0
   - `created` and `last_accessed` must be valid dates (YYYY-MM-DD format)
   - Warn about any files with invalid frontmatter
3. Rebuild MEMORY.md index sorted by confidence (highest first within each section)
4. Enforce total line count ≤ 200 by pruning lowest-confidence entries from index view
5. Keep source memory files unchanged when pruning index entries

---

## Archive Management

Files in `archive/` are kept indefinitely by default.

**Manual cleanup (recommended every 6 months):**
1. Review `archive/ARCHIVE-LOG.md` to see what was archived
2. Delete files that are clearly obsolete
3. Restore files that were archived by mistake (move back + update index)

**Never auto-delete** archived memories — always require human confirmation.

## Frontmatter Validation

During maintenance, the CLI checks each memory file's frontmatter and warns about:
- Invalid `type` values (must be: user, project, pattern, feedback)
- Invalid `confidence` values (must be 0.0 - 1.0)
- Unparseable date fields
- Missing required fields (name, type, created)

Invalid files are still processed but flagged in the output.

## Not Implemented in v1

- Background automatic session-end maintenance without explicit command invocation
- Automatic pattern extraction
- Automatic duplicate merge

---

## Maintenance Log Format

`archive/ARCHIVE-LOG.md`:

```markdown
# Archive Log

| Date | File | Reason | Confidence at Archive |
|------|------|--------|----------------------|
| 2026-03-25 | user/old-preference.md | confidence < 0.2 | 0.18 |
```

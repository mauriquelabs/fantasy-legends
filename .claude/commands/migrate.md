---
description: Sync Drizzle migration journal and run pending migrations
allowed-tools: ["Bash", "Read", "Edit"]
---

Run the project's database migrations, making sure every SQL file in `lib/db/drizzle/` is registered in the journal first.

## Steps

### 1. Discover SQL migration files

List all `.sql` files in `lib/db/drizzle/` (not inside `meta/`):

```bash
ls lib/db/drizzle/*.sql 2>/dev/null | sort
```

Extract the tag from each filename by stripping the path and `.sql` extension (e.g. `0004_leagues.sql` → `0004_leagues`).

### 2. Read the current journal

Read `lib/db/drizzle/meta/_journal.json` and collect the set of `tag` values already registered.

### 3. Add any missing entries

For each SQL file whose tag is **not** in the journal:

- Set `idx` to the next integer after the current highest `idx`.
- Set `version` to `"7"`.
- Set `when` to the current Unix timestamp in milliseconds (`Date.now()` equivalent — use `date +%s000` in bash).
- Set `tag` to the filename stem.
- Set `breakpoints` to `true`.
- Append the entry to the `entries` array in `_journal.json` using the Edit tool, maintaining valid JSON.

If entries were added, print: `Added journal entries for: <list of tags>`.

### 4. Run migrations

```bash
pnpm --filter @workspace/db migrate
```

Stream and display the full output. If the command exits non-zero, surface the error and stop.

### 5. Report

- State which migrations were newly registered (if any).
- State which migrations Drizzle applied (from its output).
- If everything was already up to date, say so clearly.

## Notes

- Never edit the `.sql` files themselves.
- Never delete journal entries — only append.
- The journal must remain valid JSON at all times; use the Edit tool for precise insertions.

# Design: claude-schedule-session-resume plugin

**Date:** 2026-04-07  
**Status:** Approved  
**Marketplace handle:** `JerrettDavis/ClaudeScheduleSessionResume`

---

## Overview

A Claude Code plugin providing a `/resume-at` command that schedules the resumption of the current Claude session at a future time. The scheduler spawns a detached Node.js watcher process that opens a new terminal window running `claude --resume <session-id> <flags>` at the target time.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  User types: /resume-at 2h30m "check build status"  │
└────────────────────────┬────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │  Skill   │  commands/resume-at.md
                    │ (Bash)   │  orchestrates the flow
                    └────┬─────┘
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────────┐
   │ Time Parser │ │ Session  │ │  Scheduler   │
   │  src/time   │ │Inspector │ │  src/sched   │
   │             │ │src/sess  │ │              │
   └──────┬──────┘ └────┬─────┘ └──────┬───────┘
          │             │              │
          └─────────────▼──────────────┘
                  compiled bin/
                  resume-at-cli.js
```

Three compiled TypeScript modules, one CLI entry point. The `/resume-at` skill invokes `node ${CLAUDE_PLUGIN_ROOT}/bin/resume-at-cli.js <args>`. The CLI handles: parse time → inspect session → cancel any prior schedule for this session → spawn new scheduler process → confirm to user.

A **SessionStart hook** runs at session open, captures the parent process CLI via `wmic` (Windows) / `ps` (Unix), and stores to `~/.claude/session-env/<session-id>/invocation.json`.

---

## Module 1: Time Parser (`src/time/parser.ts`)

Accepts a single string, returns `ParsedTime`:

```typescript
interface ParsedTime {
  targetDate: Date;
  humanLabel: string; // e.g. "in 2h 30m (10:17 PM)"
}
```

### Supported formats

| Input | Format | Notes |
|---|---|---|
| `2026-04-07T21:00:00` | ISO 8601 | Full datetime |
| `5h`, `2h30m`, `90m`, `45s` | Duration | Relative to `Date.now()` |
| `5:00pm`, `5:00 PM` | 12-hour clock | Today or tomorrow |
| `17:00`, `1700` | 24-hour / military | Today or tomorrow |
| `5pm`, `9am` | Short 12-hour | Today or tomorrow |

### Ambiguity rules

- `1700` — 4+ digits with no colon → military time (17:00), not a duration. `170m` stays a duration (trailing `m`)
- Time-of-day in the past → scheduled for **tomorrow**
- Duration always relative to `Date.now()` at command invocation
- Invalid/ambiguous input → print clear error with examples, exit non-zero

---

## Module 2: Session Inspector (`src/session/inspector.ts`)

Produces a `SessionInfo` object:

```typescript
interface SessionInfo {
  sessionId: string;         // UUID from JSONL filename
  cwd: string;               // working directory at session start
  execPath: string;          // path to claude binary
  originalArgs: string[];    // reconstructed CLI flags (minus prompt)
  permissionMode: string;    // from JSONL first entry
  invocationCmd?: string;    // raw process cmdline if captured
}
```

### Session ID resolution (in order, first success wins)

1. `CLAUDE_SESSION_ID` env var
2. Most recently modified `.jsonl` in `~/.claude/projects/<encoded-cwd>/`

### Original args reconstruction (in order, first success wins)

1. Read `~/.claude/session-env/<session-id>/invocation.json` (written by SessionStart hook)
2. Walk process tree: `wmic process` (Windows) / `ps -p $PPID` (Unix) — find the `claude` process and extract full `CommandLine`
3. Reconstruct from JSONL metadata: `permissionMode` → `--permission-mode <value>`, etc.

### Prompt stripping

Once the original command is found, strip any bare positional argument (non-flag string) at the end so it is not re-injected on resume.

### Flags forwarded on resume

All flags are forwarded **except**: `--print`, `-p`, `--output-format`, `--no-session-persistence`, `--session-id`, and the original prompt argument. `--resume <id>` replaces any `--continue`/`-c`.

---

## Module 3: Scheduler (`src/scheduler/`)

### Storage layout

```
~/.claude/schedule-resume/
├── pending/
│   ├── <sessionId-A>.json    # one file per scheduled session
│   └── <sessionId-B>.json
└── pids/
    ├── <sessionId-A>.pid     # watcher PID per session
    └── <sessionId-B>.pid
```

Multiple sessions can have concurrent pending schedules. A single session can have at most one pending schedule — scheduling a new time replaces the old one with a notification.

### `pending/<sessionId>.json` schema

```json
{
  "sessionId": "uuid",
  "targetMs": 1712534400000,
  "cmd": "claude",
  "args": ["--resume", "uuid", "--permission-mode", "bypassPermissions"],
  "cwd": "/path/to/project",
  "createdAt": "2026-04-07T21:00:00Z"
}
```

### Primary: Detached Node.js watcher

1. Write `pending/<sessionId>.json` atomically (temp file + rename)
2. If `pids/<sessionId>.pid` exists → kill old watcher, delete PID file, print "Replaced existing schedule for this session"
3. Spawn `node watcher.js --session <id>` detached (`detached: true`, `stdio: 'ignore'`, `unref()`)
4. Write new PID file

**Watcher behavior:**
- Sleeps via `setTimeout` until `targetMs`
- Reads `pending/<sessionId>.json` to confirm it's still the current schedule (not replaced)
- Spawns `claude --resume <id> <flags>` in a new terminal window:
  - **Windows:** `wt` (Windows Terminal) if available, else `Start-Process pwsh`
  - **macOS:** `open -a Terminal` or `osascript -e 'tell app "Terminal" to do script "..."'`
  - **Linux:** tries `gnome-terminal`, `xterm`, `konsole` in order
- Deletes `pending/<sessionId>.json` and `pids/<sessionId>.pid`
- Exits cleanly

### Fallback: OS Task Scheduler (opt-in)

Activated when Node watcher spawn fails, or user passes `--os-scheduler`. Warns that elevation may be required.

- **Windows:** `schtasks /create /TN "ClaudeResume-<sessionId>" /TR "pwsh -Command claude --resume <id> <flags>" /SC ONCE /ST <HH:MM>`
- **Unix:** `echo "claude --resume <id> <flags>" | at <time>`
- OS task is deleted after it fires or when replaced by a new schedule

### Subcommands

| Command | Behavior |
|---|---|
| `/resume-at <time> [prompt]` | Schedule resume for current session |
| `/resume-at cancel` | Cancel schedule for current session, clean up watcher + files |
| `/resume-at list` | Show all pending schedules across all sessions |

---

## Plugin Structure

```
claude-schedule-session-resume/
├── .claude-plugin/
│   └── plugin.json              # manifest
├── commands/
│   └── resume-at.md             # /resume-at skill
├── hooks/
│   └── hooks.json               # SessionStart hook
├── src/
│   ├── cli.ts                   # entry point: parse argv, orchestrate
│   ├── time/
│   │   ├── parser.ts
│   │   └── parser.test.ts
│   ├── session/
│   │   ├── inspector.ts
│   │   ├── inspector.test.ts
│   │   └── capture-hook.ts      # run by SessionStart hook
│   └── scheduler/
│       ├── scheduler.ts
│       ├── watcher.ts           # detached process entry point
│       ├── os-fallback.ts
│       └── terminal.ts          # cross-platform terminal launcher
├── bin/
│   └── resume-at-cli.js         # compiled output (gitignored)
├── scripts/
│   └── postinstall.js           # runs tsc, verifies node version
├── tests/
│   └── e2e/
│       ├── Dockerfile
│       ├── docker-compose.yml
│       └── resume-at.e2e.ts
├── docs/
│   └── superpowers/specs/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── CLAUDE.md
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

---

## CI/CD & Release

### CI (`ci.yml`)
- Triggers: PR, push to `main`
- Steps: `npm ci` → `npm run build` → `npm run lint` → `npm test`
- Matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`

### Release (`release.yml`)
- Triggers: `v*` tag push
- Steps: build + test on all platforms → pack plugin → publish via `claude plugin publish`
- Requires `CLAUDE_MARKETPLACE_TOKEN` secret

### E2E Docker tests
- `FROM node:22-slim` with Claude Code installed
- Plugin installed from local path (mirrors `claude plugin install` flow)
- Session fixtures are JSON stubs — no real Claude session or API key needed
- Tests verify: time parsing, session ID resolution, watcher spawn + PID file, `cancel` cleanup, `list` output

---

## Repo Hygiene

- `CONTRIBUTING.md` — dev setup, build, test, PR process
- `CHANGELOG.md` — keep-a-changelog format, auto-updated by release workflow
- Issue templates: bug report + feature request
- PR template with checklist (tests, changelog, docs)
- `LICENSE` — MIT

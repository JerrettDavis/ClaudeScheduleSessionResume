# claude-schedule-session-resume

## Project Overview

A Claude Code plugin providing a `/resume-at` command that schedules the resumption of the current Claude session at a future time. It spawns a detached Node.js watcher process that opens a new terminal window running `claude --resume <session-id>` at the target time.

## Architecture

- **src/time/parser.ts** — Parses time input strings into target dates
- **src/session/inspector.ts** — Resolves session ID and original invocation args
- **src/session/capture-hook.ts** — SessionStart hook that saves invocation.json
- **src/scheduler/scheduler.ts** — Manages pending schedules and watcher processes
- **src/scheduler/watcher.ts** — Detached process that fires at target time
- **src/scheduler/terminal.ts** — Cross-platform terminal launcher
- **src/scheduler/os-fallback.ts** — schtasks/at integration
- **src/resume-at-cli.ts** — CLI entry point

## Build & Test

```bash
npm run build          # Compile TypeScript to bin/
npm test               # Run unit tests
npm run test:e2e       # Run E2E tests in Docker
npm run lint           # ESLint
```

## Key Decisions

- CommonJS output (not ESM) for maximum Claude Code compatibility
- Detached watcher process so schedules survive the original session ending
- Atomic file writes (tmp + rename) to prevent corrupted pending.json
- OS-level fallback as safety net if the Node.js watcher dies
- SessionStart hook captures invocation args since they are not available at /resume-at time

## Storage Locations

- Pending schedules: `~/.claude/schedule-resume/pending/<sessionId>.json`
- Watcher PIDs: `~/.claude/schedule-resume/pids/<sessionId>.pid`
- Invocation capture: `~/.claude/session-env/<sessionId>/invocation.json`

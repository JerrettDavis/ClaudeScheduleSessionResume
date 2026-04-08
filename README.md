# claude-schedule-session-resume

A Claude Code plugin that schedules resumption of the current session at a future time. It spawns a detached Node.js watcher process that opens a new terminal window running `claude --resume <session-id>` at the target time.

## Installation

```bash
claude plugin add /path/to/claude-schedule-session-resume
```

Or install from GitHub:

```bash
git clone https://github.com/JerrettDavis/ClaudeScheduleSessionResume.git
cd ClaudeScheduleSessionResume
npm install
claude plugin add .
```

## Usage

### Schedule a resume

```
/resume-at 2h                          # Resume in 2 hours
/resume-at 5pm                         # Resume at 5:00 PM
/resume-at 17:00                       # Resume at 17:00
/resume-at 1700                        # Resume at 17:00 (military)
/resume-at 2h30m                       # Resume in 2 hours 30 minutes
/resume-at 2026-04-07T21:00:00         # Resume at specific datetime
/resume-at 2h "check the build"        # Resume with a prompt
```

### Cancel a scheduled resume

```
/resume-at cancel
```

### List pending schedules

```
/resume-at list
```

## How It Works

1. **SessionStart hook** captures the original `claude` invocation command when a session opens
2. **`/resume-at` command** parses the time input, inspects the current session, and schedules a resume
3. A **detached watcher process** sleeps until the target time, then launches a new terminal window with `claude --resume <session-id>` plus any forwarded flags
4. An **OS-level fallback** (Windows `schtasks` / Unix `at`) is registered if the watcher process fails to spawn

## Supported Time Formats

| Format | Example | Description |
|--------|---------|-------------|
| Duration | `5h`, `2h30m`, `90m`, `45s` | Relative to now |
| 12-hour | `5pm`, `5:30pm`, `9am` | Next occurrence |
| 24-hour | `17:00`, `9:30` | Next occurrence |
| Military | `1700`, `0930` | Next occurrence |
| ISO 8601 | `2026-04-07T21:00:00` | Exact datetime |

Time-of-day formats in the past automatically advance to the next day.

## Requirements

- Node.js >= 18
- Claude Code CLI

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run unit tests
npm run lint         # Run ESLint
npm run test:e2e     # Run E2E tests in Docker
```

## License

MIT

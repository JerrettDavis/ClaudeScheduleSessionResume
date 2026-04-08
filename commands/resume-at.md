---
description: Schedule this session to resume at a future time
allowed-tools: Bash
---

Run the following command and print its output to the user:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/resume-at-cli.js" $ARGUMENTS
```

If the command exits non-zero, print the error and explain the valid formats:
- Duration: `5h`, `2h30m`, `90m`, `45s`
- Time: `5pm`, `5:00pm`, `17:00`, `1700`
- Datetime: `2026-04-07T21:00:00`
- Subcommands: `cancel`, `list`
- Optional continue prompt: `/resume-at 2h "check the build"`

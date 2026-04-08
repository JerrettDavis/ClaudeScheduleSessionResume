# 1.0.0 (2026-04-08)


### Bug Fixes

* correct wmic CommandLine column slice; improve test isolation ([309bb62](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/309bb62670a1f4d0e5916dd37bf2763115c432c0))
* downgrade ESLint to v8 for .eslintrc compatibility; simplify postinstall ([e082569](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/e082569b14c5843bd6a27dc67361793bd4df439c))
* eliminate prompt duplication, escape shell args, clean up tests ([e6e1aa1](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/e6e1aa1fd8d168137638437b37210f82f4408ba4))
* formatDuration includes seconds with hours; ISO rejects past datetimes ([0361142](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/03611424ed7a3468d69604dfbca089a893ab0f80))
* override exclude in tsconfig.test.json so test files are included ([5967418](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/5967418d5533fee671d5094d61cef394342b781b))


### Features

* add CLI entry point with schedule, cancel, and list commands ([2feb3f5](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/2feb3f501bebcf18b31f58cb485df9855924f0af))
* add cross-platform terminal launcher ([a426520](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/a4265207d45a7b9a60a1fc55df5f8545362201e1))
* add detached watcher process for timed session resume ([50cb4ee](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/50cb4ee576e587b3b7b2380c8130c99b41b068bc))
* add E2E Docker tests for CLI integration ([b7dfbfc](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/b7dfbfce2cd14040fd1ffe6b6eafe110fee62b8d))
* add GitHub Actions CI/release workflows and issue templates ([6963074](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/69630745581caba20f8abc27b9317255ae7ef06a))
* add marketplace manifest and semantic-release automation ([ecd0401](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/ecd04017979120a3045660c52b3deac5d7e607b3))
* add OS-level task fallback using schtasks and at ([ca0e5e7](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/ca0e5e7bf07b8bb7148704136afe73fb35f4163d))
* add plugin manifest, slash command, hook config, and postinstall ([2b46c0a](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/2b46c0aaadaafcc3af41bef15e22474ef2e37213))
* add scheduler with atomic file operations, cancel, and list ([2d69bf6](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/2d69bf650a69b3f2cea64ce83c3e2f118e1e1d35))
* add session inspector with ID resolution and JSONL reading ([0af5110](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/0af5110d4a87ef93b038b258360f1f16c6005896))
* add SessionStart capture hook for invocation args ([e7288a6](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/e7288a669618f0521443271b05927dd1801843fb))
* add time parser with ISO, duration, military, 24h, and 12h formats ([70120e3](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/70120e32ae4654a2ec18198472aabfba9e40d45b))
* scaffold project with TypeScript, vitest, and ESLint ([9c7dd44](https://github.com/JerrettDavis/ClaudeScheduleSessionResume/commit/9c7dd441dc0f7ca995a224ed2fbf611f4a3f8522))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-07

### Added

- `/resume-at` slash command for scheduling session resumption
- Time parser supporting ISO 8601, duration, military, 24-hour, and 12-hour formats
- Session inspector for resolving session ID and original invocation args
- SessionStart capture hook for saving invocation command
- Detached watcher process for timed terminal launch
- Cross-platform terminal launcher (Windows Terminal, macOS Terminal.app, Linux terminal emulators)
- OS-level fallback using `schtasks` (Windows) and `at` (Unix)
- `cancel` and `list` subcommands
- Optional continue prompt forwarding
- E2E Docker test suite
- GitHub Actions CI/CD workflows

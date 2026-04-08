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

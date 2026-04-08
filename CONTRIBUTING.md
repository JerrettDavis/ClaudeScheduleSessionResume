# Contributing to claude-schedule-session-resume

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run tests: `npm test`

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Ensure the build succeeds: `npm run build`
6. Ensure lint passes: `npm run lint`
7. Submit a pull request

## Code Style

- TypeScript strict mode
- ESLint configuration in `.eslintrc.json`
- Prefer `const` over `let`
- Use explicit return types for exported functions
- Handle errors gracefully — this plugin must never break a Claude session

## Testing

- Unit tests: `src/**/*.test.ts` (vitest)
- E2E tests: `tests/e2e/` (Docker-based)
- All time-dependent tests should use a fixed `now` parameter

## Commit Messages

Use conventional commit format:

```
feat(scope): description
fix(scope): description
docs: description
test: description
chore: description
```

Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` when AI-assisted.

## Reporting Issues

Use the GitHub issue templates for bug reports and feature requests.

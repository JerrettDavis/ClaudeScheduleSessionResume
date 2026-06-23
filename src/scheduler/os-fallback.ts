import { execFileSync } from 'child_process';
import { PendingSchedule } from './scheduler';

function escapePwsh(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeShellArg(value: string): string {
  // Escape all characters that are special inside a POSIX double-quoted string.
  // Backslash must come first to avoid double-escaping.
  return value
    .replace(/\\/g, '\\\\')   // \ → \\
    .replace(/"/g, '\\"')      // " → \"
    .replace(/\$/g, '\\$')     // $ → \$ (prevent variable expansion)
    .replace(/`/g, '\\`')      // ` → \` (prevent command substitution)
    .replace(/!/g, '\\!');     // ! → \! (prevent history expansion)
}

function formatTimeForSchtasks(targetMs: number): string {
  const date = new Date(targetMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateForSchtasks(targetMs: number): string {
  const date = new Date(targetMs);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatForAt(targetMs: number): string {
  const date = new Date(targetMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${hh}:${mm} ${yyyy}-${mo}-${dd}`;
}

export function registerOsTask(schedule: PendingSchedule): void {
  const id8 = schedule.sessionId.substring(0, 8);

  // Build the claude invocation with properly-escaped args.
  // Each arg is handled individually to avoid any shell word-splitting.
  const claudeArgParts = [...schedule.args];
  if (schedule.prompt) {
    claudeArgParts.push(schedule.prompt);
  }
  const claudeCmd = `claude ${claudeArgParts.map(a => `"${escapeShellArg(a)}"`).join(' ')}`;

  if (process.platform === 'win32') {
    // Build the PowerShell command string that will run inside the scheduled task.
    // The cd path uses single-quote PowerShell escaping; the claude command uses
    // double-quote POSIX escaping (PowerShell honours both).
    const psCommand = `cd '${escapePwsh(schedule.cwd)}' ; ${claudeCmd}`;
    const hhMM = formatTimeForSchtasks(schedule.targetMs);
    const date = formatDateForSchtasks(schedule.targetMs);

    // Pass each schtasks flag as a separate array element — no shell involved.
    // execFileSync bypasses cmd.exe entirely so no shell metacharacter injection is possible.
    try {
      execFileSync('schtasks', [
        '/create', '/F',
        '/TN', `ClaudeResume-${id8}`,
        '/TR', `pwsh -NoExit -Command "${psCommand}"`,
        '/SC', 'ONCE',
        '/ST', hhMM,
        '/SD', date,
      ], { stdio: 'pipe', timeout: 10000 });
    } catch (err) {
      throw new Error(`Failed to create Windows scheduled task: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const atTime = formatForAt(schedule.targetMs);
    // Build the shell script line that `at` will execute.
    // escapeShellArg ensures no shell metacharacters can break out of the double-quoted string.
    const fullCmd = `cd "${escapeShellArg(schedule.cwd)}" && ${claudeCmd}`;

    // Feed the command to `at` via stdin (execFileSync with input option) rather than
    // constructing a shell pipeline, so atTime cannot be injected.
    try {
      execFileSync('at', [atTime], {
        input: fullCmd,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
    } catch (err) {
      throw new Error(`Failed to create at job: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function removeOsTask(sessionId: string): void {
  const id8 = sessionId.substring(0, 8);

  if (process.platform === 'win32') {
    try {
      // Use execFileSync with argument array to avoid shell injection.
      execFileSync('schtasks', ['/delete', '/TN', `ClaudeResume-${id8}`, '/F'], {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch {
      // Best-effort removal — ignore errors
    }
  } else {
    // at jobs don't have named identifiers, so removal is best-effort
    // The watcher handles most cases; OS fallback is supplementary
  }
}

export { formatTimeForSchtasks, formatDateForSchtasks, formatForAt };

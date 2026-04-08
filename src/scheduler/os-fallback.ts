import { execSync } from 'child_process';
import { PendingSchedule } from './scheduler';

function escapePwsh(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeShellArg(value: string): string {
  return value.replace(/"/g, '\\"');
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
  const claudeArgs = schedule.args.join(' ');
  const promptSuffix = schedule.prompt ? ` "${escapeShellArg(schedule.prompt)}"` : '';
  const claudeCmd = `claude ${claudeArgs}${promptSuffix}`;

  if (process.platform === 'win32') {
    const cmdLine = `pwsh -NoExit -Command "cd '${escapePwsh(schedule.cwd)}' ; ${claudeCmd}"`;
    const hhMM = formatTimeForSchtasks(schedule.targetMs);
    const date = formatDateForSchtasks(schedule.targetMs);

    try {
      execSync(
        `schtasks /create /F /TN "ClaudeResume-${id8}" /TR "${cmdLine}" /SC ONCE /ST ${hhMM} /SD ${date}`,
        { stdio: 'pipe', timeout: 10000 }
      );
    } catch (err) {
      throw new Error(`Failed to create Windows scheduled task: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const atTime = formatForAt(schedule.targetMs);
    const fullCmd = `cd "${escapeShellArg(schedule.cwd)}" && ${claudeCmd}`;

    try {
      execSync(`echo "${fullCmd}" | at ${atTime}`, {
        stdio: 'pipe',
        timeout: 10000,
        shell: '/bin/sh',
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
      execSync(`schtasks /delete /TN "ClaudeResume-${id8}" /F`, {
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

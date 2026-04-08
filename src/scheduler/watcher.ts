import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { launchTerminal } from './terminal';

interface PendingSchedule {
  sessionId: string;
  targetMs: number;
  execPath: string;
  args: string[];
  cwd: string;
  prompt?: string;
  createdAt: string;
}

function getScheduleDir(): string {
  return path.join(os.homedir(), '.claude', 'schedule-resume');
}

function getPendingPath(sessionId: string): string {
  return path.join(getScheduleDir(), 'pending', `${sessionId}.json`);
}

function getPidPath(sessionId: string): string {
  return path.join(getScheduleDir(), 'pids', `${sessionId}.pid`);
}

function readPending(sessionId: string): PendingSchedule | null {
  const filePath = getPendingPath(sessionId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as PendingSchedule;
  } catch {
    return null;
  }
}

function cleanup(sessionId: string): void {
  try {
    const pendingPath = getPendingPath(sessionId);
    if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
  } catch {
    // Ignore cleanup errors
  }

  try {
    const pidPath = getPidPath(sessionId);
    if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
  } catch {
    // Ignore cleanup errors
  }
}

function buildTerminalCommand(pending: PendingSchedule): string {
  const claudeArgs = pending.args.join(' ');
  const promptSuffix = pending.prompt ? ` "${pending.prompt}"` : '';

  if (process.platform === 'win32') {
    return `cd "${pending.cwd}" ; claude ${claudeArgs}${promptSuffix}`;
  }
  return `cd "${pending.cwd}" && claude ${claudeArgs}${promptSuffix}`;
}

function main(): void {
  // Parse --session argument
  const sessionArgIndex = process.argv.indexOf('--session');
  if (sessionArgIndex === -1 || sessionArgIndex + 1 >= process.argv.length) {
    console.error('Usage: watcher.js --session <sessionId>');
    process.exit(1);
  }
  const sessionId = process.argv[sessionArgIndex + 1];

  // Read the pending schedule
  const pending = readPending(sessionId);
  if (!pending) {
    console.error(`No pending schedule found for session ${sessionId}`);
    process.exit(1);
  }

  // Calculate delay
  const delay = pending.targetMs - Date.now();
  if (delay < 0) {
    console.error(`Schedule for session ${sessionId} has already expired`);
    cleanup(sessionId);
    process.exit(0);
  }

  // Node.js max setTimeout value (~24.8 days)
  const maxTimeout = 2147483647;

  function scheduleWithChaining(remainingMs: number): void {
    if (remainingMs <= 0) {
      fire();
      return;
    }

    const chunk = Math.min(remainingMs, maxTimeout);
    setTimeout(() => {
      scheduleWithChaining(remainingMs - chunk);
    }, chunk);
  }

  function fire(): void {
    // Re-read pending to check if cancelled or replaced
    const currentPending = readPending(sessionId);
    if (!currentPending || currentPending.sessionId !== sessionId) {
      // Cancelled or replaced — exit silently
      process.exit(0);
    }

    // Build and launch terminal command
    const cmd = buildTerminalCommand(currentPending);

    try {
      launchTerminal(cmd);
    } catch (err) {
      console.error('Failed to launch terminal:', (err as Error).message);
    }

    // Clean up
    cleanup(sessionId);
    process.exit(0);
  }

  scheduleWithChaining(delay);
}

main();

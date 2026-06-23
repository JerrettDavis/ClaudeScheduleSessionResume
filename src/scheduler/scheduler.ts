import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PendingSchedule {
  sessionId: string;
  targetMs: number;
  execPath: string;
  args: string[];
  cwd: string;
  prompt?: string;
  createdAt: string;
}

export interface ScheduleResult {
  replaced: boolean;
  watcherFailed: boolean;
}

function getScheduleDir(): string {
  return path.join(os.homedir(), '.claude', 'schedule-resume');
}

function getPendingDir(): string {
  return path.join(getScheduleDir(), 'pending');
}

function getPidsDir(): string {
  return path.join(getScheduleDir(), 'pids');
}

function getPendingPath(sessionId: string): string {
  return path.join(getPendingDir(), `${sessionId}.json`);
}

function getPidPath(sessionId: string): string {
  return path.join(getPidsDir(), `${sessionId}.pid`);
}

function ensureDirs(): void {
  fs.mkdirSync(getPendingDir(), { recursive: true });
  fs.mkdirSync(getPidsDir(), { recursive: true });
}

function writePendingAtomic(pending: PendingSchedule): void {
  const targetPath = getPendingPath(pending.sessionId);
  const tmpPath = targetPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(pending, null, 2), 'utf-8');
  fs.renameSync(tmpPath, targetPath);
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

function killWatcherProcess(sessionId: string): void {
  const pidPath = getPidPath(sessionId);
  if (!fs.existsSync(pidPath)) return;

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // Process may already be dead — ignore
      }
    }
  } catch {
    // Ignore read errors
  }

  try {
    fs.unlinkSync(pidPath);
  } catch {
    // Ignore unlink errors
  }
}

function writePid(sessionId: string, pid: number): void {
  fs.writeFileSync(getPidPath(sessionId), String(pid), 'utf-8');
}

function defaultSpawnWatcher(pending: PendingSchedule, pluginRoot: string): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawn } = require('child_process');
    const watcherPath = path.join(pluginRoot, 'bin', 'scheduler', 'watcher.js');

    if (!fs.existsSync(watcherPath)) {
      return null;
    }

    const child = spawn(
      process.execPath,
      [watcherPath, '--session', pending.sessionId],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    return child.pid ?? null;
  } catch {
    return null;
  }
}

export async function scheduleResume(
  pending: PendingSchedule,
  pluginRoot: string,
  spawnWatcher?: (pending: PendingSchedule, pluginRoot: string) => number | null
): Promise<ScheduleResult> {
  ensureDirs();

  // Check if a schedule already exists for this session
  const existingPidPath = getPidPath(pending.sessionId);
  const replaced = fs.existsSync(existingPidPath);
  if (replaced) {
    killWatcherProcess(pending.sessionId);
  }

  // Write pending schedule atomically
  writePendingAtomic(pending);

  // Spawn watcher
  let watcherFailed = false;
  const spawner = spawnWatcher ?? defaultSpawnWatcher;
  const pid = spawner(pending, pluginRoot);
  if (pid !== null) {
    writePid(pending.sessionId, pid);
  } else {
    watcherFailed = true;
  }

  return { replaced, watcherFailed };
}

export async function cancelResume(sessionId: string): Promise<boolean> {
  let cancelled = false;

  // Kill watcher process
  const pidPath = getPidPath(sessionId);
  if (fs.existsSync(pidPath)) {
    killWatcherProcess(sessionId);
    cancelled = true;
  }

  // Delete pending schedule
  const pendingPath = getPendingPath(sessionId);
  if (fs.existsSync(pendingPath)) {
    try {
      fs.unlinkSync(pendingPath);
      cancelled = true;
    } catch {
      // Ignore
    }
  }

  // Try to remove OS scheduled task (best-effort)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require('child_process');
    const id8 = sessionId.substring(0, 8);
    if (process.platform === 'win32') {
      // Use execFileSync with argument array — bypasses cmd.exe so no shell injection is possible.
      execFileSync('schtasks', ['/delete', '/TN', `ClaudeResume-${id8}`, '/F'], {
        stdio: 'pipe',
        timeout: 5000,
      });
      cancelled = true;
    }
    // Unix atrm requires knowing the job number — skip for now
  } catch {
    // OS task removal is best-effort
  }

  return cancelled;
}

export function listPending(): PendingSchedule[] {
  const pendingDir = getPendingDir();
  if (!fs.existsSync(pendingDir)) return [];

  const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
  const schedules: PendingSchedule[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
      const schedule = JSON.parse(content) as PendingSchedule;
      schedules.push(schedule);
    } catch {
      // Skip malformed files
    }
  }

  return schedules.sort((a, b) => a.targetMs - b.targetMs);
}

export {
  getScheduleDir,
  getPendingDir,
  getPidsDir,
  getPendingPath,
  getPidPath,
  ensureDirs,
  writePendingAtomic,
  readPending,
  killWatcherProcess,
  writePid,
};

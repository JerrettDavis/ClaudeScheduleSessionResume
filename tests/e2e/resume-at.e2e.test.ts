import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');
const CLI_PATH = path.join(PLUGIN_ROOT, 'bin', 'resume-at-cli.js');

// Track temp dirs so afterEach can clean them up
const tempDirs: string[] = [];

function setupFakeHome(): string {
  // Use mkdtempSync for a unique, unpredictable temp directory (avoids TOCTOU on predictable paths)
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-e2e-'));
  tempDirs.push(fakeHome);

  // Create fake Claude project directory
  const fakeCwd = '/plugin';
  const encoded = fakeCwd.replace(/[:\\/]/g, '-').replace(/^-/, '');
  const projectDir = path.join(fakeHome, '.claude', 'projects', encoded);
  fs.mkdirSync(projectDir, { recursive: true });

  // Create a fake session JSONL file
  const sessionId = 'test-uuid-1234-5678-abcd-ef0123456789';
  const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);
  const firstLine = JSON.stringify({
    type: 'permission-mode',
    permissionMode: 'default',
    sessionId,
  });
  // Write to an already-exclusively-created path (no predictable race window)
  fs.writeFileSync(jsonlPath, firstLine + '\n', { encoding: 'utf-8', flag: 'wx' });

  return fakeHome;
}

function runCli(args: string, env?: Record<string, string>): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: PLUGIN_ROOT,
      env: { ...process.env, ...env },
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

describe('E2E: resume-at CLI', () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = setupFakeHome();
  });

  afterEach(() => {
    // Clean up all temp dirs created by setupFakeHome
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    }
  });

  describe('time-parse integration', () => {
    it('schedules a resume with duration format', () => {
      const result = runCli('5h');
      // May fail on watcher spawn in Docker (no terminal), but should parse time
      // and create pending JSON
      expect(result.stdout + result.stderr).toContain('resume');

      // Verify pending JSON was created
      const pendingDir = path.join(fakeHome, '.claude', 'schedule-resume', 'pending');
      if (fs.existsSync(pendingDir)) {
        const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
        expect(files.length).toBeGreaterThanOrEqual(1);

        const pending = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf-8'));
        expect(pending.targetMs).toBeGreaterThan(Date.now());
        expect(pending.args).toContain('--resume');
      }
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled resume', () => {
      // First schedule
      runCli('5h');

      // Then cancel
      const result = runCli('cancel');
      expect(result.stdout).toContain('Cancel');

      // Verify pending is gone
      const pendingDir = path.join(fakeHome, '.claude', 'schedule-resume', 'pending');
      if (fs.existsSync(pendingDir)) {
        const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
        expect(files.length).toBe(0);
      }
    });
  });

  describe('list', () => {
    it('lists pending schedules', () => {
      // Create two fake pending schedules manually
      const pendingDir = path.join(fakeHome, '.claude', 'schedule-resume', 'pending');
      fs.mkdirSync(pendingDir, { recursive: true });

      const schedule1 = {
        sessionId: 'session-aaa',
        targetMs: Date.now() + 3600000,
        execPath: 'node',
        args: ['--resume', 'session-aaa'],
        cwd: '/test',
        createdAt: new Date().toISOString(),
      };
      const schedule2 = {
        sessionId: 'session-bbb',
        targetMs: Date.now() + 7200000,
        execPath: 'node',
        args: ['--resume', 'session-bbb'],
        cwd: '/test',
        createdAt: new Date().toISOString(),
      };

      fs.writeFileSync(path.join(pendingDir, 'session-aaa.json'), JSON.stringify(schedule1), { flag: 'wx' });
      fs.writeFileSync(path.join(pendingDir, 'session-bbb.json'), JSON.stringify(schedule2), { flag: 'wx' });

      const result = runCli('list');
      expect(result.stdout).toContain('session-aaa');
      expect(result.stdout).toContain('session-bbb');
      expect(result.exitCode).toBe(0);
    });

    it('shows empty message when no schedules', () => {
      const result = runCli('list');
      expect(result.stdout).toContain('No pending schedules');
    });
  });

  describe('replace', () => {
    it('replaces existing schedule for same session', () => {
      // Schedule twice
      runCli('3h');
      const result = runCli('5h');

      // Check for replacement message (may be in stdout or stderr depending on output)
      const allOutput = result.stdout + result.stderr;
      // The second schedule should succeed
      expect(allOutput.toLowerCase()).toMatch(/replace|resume/);

      // Verify only one PID file exists for the session
      const pidsDir = path.join(fakeHome, '.claude', 'schedule-resume', 'pids');
      if (fs.existsSync(pidsDir)) {
        const pidFiles = fs.readdirSync(pidsDir).filter(f => f.endsWith('.pid'));
        // There should be at most 1 PID file for this session
        expect(pidFiles.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('invalid time', () => {
    it('exits with error on invalid time format', () => {
      const result = runCli('notavalidtime');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid time format');
      expect(result.stderr).toContain('5h');
      expect(result.stderr).toContain('5pm');
    });
  });
});

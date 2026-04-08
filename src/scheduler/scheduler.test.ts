import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Must hoist vi.mock before imports are resolved
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn(() => actual.homedir()),
  };
});

import {
  scheduleResume,
  cancelResume,
  listPending,
  PendingSchedule,
} from './scheduler';

let tmpHome: string;

function makePending(overrides: Partial<PendingSchedule> = {}): PendingSchedule {
  return {
    sessionId: 'test-session-1234',
    targetMs: Date.now() + 3600000,
    execPath: '/usr/local/bin/node',
    args: ['--resume', 'test-session-1234'],
    cwd: '/home/user/project',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('scheduler file operations', () => {
  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-at-sched-'));
    vi.mocked(os.homedir).mockReturnValue(tmpHome);
  });

  afterEach(() => {
    vi.mocked(os.homedir).mockReset();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe('scheduleResume', () => {
    it('creates pending JSON file', async () => {
      const pending = makePending();
      const mockSpawn = vi.fn().mockReturnValue(12345);

      await scheduleResume(pending, '/fake/plugin', mockSpawn);

      const pendingPath = path.join(tmpHome, '.claude', 'schedule-resume', 'pending', `${pending.sessionId}.json`);
      expect(fs.existsSync(pendingPath)).toBe(true);

      const written = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
      expect(written.sessionId).toBe('test-session-1234');
      expect(written.targetMs).toBe(pending.targetMs);
    });

    it('writes PID file when watcher spawns', async () => {
      const pending = makePending();
      const mockSpawn = vi.fn().mockReturnValue(99999);

      await scheduleResume(pending, '/fake/plugin', mockSpawn);

      const pidPath = path.join(tmpHome, '.claude', 'schedule-resume', 'pids', `${pending.sessionId}.pid`);
      expect(fs.existsSync(pidPath)).toBe(true);
      expect(fs.readFileSync(pidPath, 'utf-8')).toBe('99999');
    });

    it('returns watcherFailed=true when spawn returns null', async () => {
      const pending = makePending();
      const mockSpawn = vi.fn().mockReturnValue(null);

      const result = await scheduleResume(pending, '/fake/plugin', mockSpawn);
      expect(result.watcherFailed).toBe(true);
    });

    it('returns replaced=true when PID file already exists', async () => {
      const pending = makePending();
      const mockSpawn = vi.fn().mockReturnValue(11111);

      // First schedule
      await scheduleResume(pending, '/fake/plugin', mockSpawn);

      // Second schedule for same session — should detect replacement
      const result = await scheduleResume(pending, '/fake/plugin', vi.fn().mockReturnValue(22222));
      expect(result.replaced).toBe(true);
    });
  });

  describe('cancelResume', () => {
    it('deletes pending and PID files', async () => {
      const pending = makePending();
      await scheduleResume(pending, '/fake/plugin', vi.fn().mockReturnValue(12345));

      const cancelled = await cancelResume(pending.sessionId);
      expect(cancelled).toBe(true);

      const pendingPath = path.join(tmpHome, '.claude', 'schedule-resume', 'pending', `${pending.sessionId}.json`);
      const pidPath = path.join(tmpHome, '.claude', 'schedule-resume', 'pids', `${pending.sessionId}.pid`);
      expect(fs.existsSync(pendingPath)).toBe(false);
      expect(fs.existsSync(pidPath)).toBe(false);
    });

    it('returns false when nothing is pending', async () => {
      const cancelled = await cancelResume('nonexistent-session');
      expect(cancelled).toBe(false);
    });
  });

  describe('listPending', () => {
    it('returns empty array when no schedules exist', () => {
      const result = listPending();
      expect(result).toEqual([]);
    });

    it('returns all pending schedules sorted by targetMs', async () => {
      const pending1 = makePending({ sessionId: 'session-a', targetMs: Date.now() + 7200000 });
      const pending2 = makePending({ sessionId: 'session-b', targetMs: Date.now() + 3600000 });

      await scheduleResume(pending1, '/fake/plugin', vi.fn().mockReturnValue(11111));
      await scheduleResume(pending2, '/fake/plugin', vi.fn().mockReturnValue(22222));

      const result = listPending();
      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-b'); // earlier target
      expect(result[1].sessionId).toBe('session-a');
    });

    it('skips malformed JSON files', async () => {
      const pending = makePending();
      await scheduleResume(pending, '/fake/plugin', vi.fn().mockReturnValue(11111));

      // Write a malformed file alongside
      const pendingDir = path.join(tmpHome, '.claude', 'schedule-resume', 'pending');
      fs.writeFileSync(path.join(pendingDir, 'bad.json'), '{broken json', 'utf-8');

      const result = listPending();
      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe(pending.sessionId);
    });
  });
});

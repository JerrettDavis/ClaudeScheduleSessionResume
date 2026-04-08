import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  resolveSessionId,
  readPermissionMode,
  encodeCwd,
  stripPrompt,
  filterExcludedFlags,
  buildResumeArgs,
} from './inspector';

describe('encodeCwd', () => {
  it('replaces colons and slashes with dashes', () => {
    // Windows path: C:\Users\test\project
    const result = encodeCwd('C:\\Users\\test\\project');
    expect(result).toBe('C--Users-test-project');
  });

  it('handles forward slashes', () => {
    expect(encodeCwd('/home/user/project')).toBe('home-user-project');
  });

  it('strips leading dash', () => {
    expect(encodeCwd('/home')).toBe('home');
  });
});

describe('resolveSessionId', () => {
  let tmpDir: string;
  const originalEnv = process.env.CLAUDE_SESSION_ID;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-at-test-'));
    delete process.env.CLAUDE_SESSION_ID;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_SESSION_ID = originalEnv;
    } else {
      delete process.env.CLAUDE_SESSION_ID;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns CLAUDE_SESSION_ID from environment', () => {
    process.env.CLAUDE_SESSION_ID = 'env-session-id-1234';
    expect(resolveSessionId()).toBe('env-session-id-1234');
  });

  it('throws when no session ID can be found', () => {
    const fakeCwd = path.join(tmpDir, 'nonexistent-project');
    expect(() => resolveSessionId(fakeCwd)).toThrow('Could not resolve session ID');
  });
});

describe('readPermissionMode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-at-perm-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default when JSONL file does not exist', () => {
    const result = readPermissionMode('nonexistent-id', tmpDir);
    expect(result).toBe('default');
  });
});

describe('stripPrompt', () => {
  it('removes last non-flag argument', () => {
    const args = ['--permission-mode', 'default', 'check the build'];
    expect(stripPrompt(args)).toEqual(['--permission-mode', 'default']);
  });

  it('preserves args when last is a flag', () => {
    const args = ['--permission-mode', 'default', '--verbose'];
    expect(stripPrompt(args)).toEqual(['--permission-mode', 'default', '--verbose']);
  });

  it('handles empty args', () => {
    expect(stripPrompt([])).toEqual([]);
  });

  it('handles single non-flag arg', () => {
    expect(stripPrompt(['hello'])).toEqual([]);
  });
});

describe('filterExcludedFlags', () => {
  it('removes --print', () => {
    expect(filterExcludedFlags(['--print'])).toEqual([]);
  });

  it('removes -p', () => {
    expect(filterExcludedFlags(['-p'])).toEqual([]);
  });

  it('removes --continue and -c', () => {
    expect(filterExcludedFlags(['--continue'])).toEqual([]);
    expect(filterExcludedFlags(['-c'])).toEqual([]);
  });

  it('removes --session-id with its value', () => {
    expect(filterExcludedFlags(['--session-id', 'abc-123', '--verbose'])).toEqual(['--verbose']);
  });

  it('removes --output-format with its value', () => {
    expect(filterExcludedFlags(['--output-format', 'json', '--verbose'])).toEqual(['--verbose']);
  });

  it('preserves unrelated flags', () => {
    expect(filterExcludedFlags(['--verbose', '--permission-mode', 'default'])).toEqual([
      '--verbose',
      '--permission-mode',
      'default',
    ]);
  });

  it('removes --no-session-persistence', () => {
    expect(filterExcludedFlags(['--no-session-persistence'])).toEqual([]);
  });

  it('handles empty args', () => {
    expect(filterExcludedFlags([])).toEqual([]);
  });
});

describe('buildResumeArgs', () => {
  it('prepends --resume with session ID', () => {
    const result = buildResumeArgs('session-123', ['--verbose']);
    expect(result).toEqual(['--resume', 'session-123', '--verbose']);
  });

  it('filters excluded flags before building', () => {
    const result = buildResumeArgs('session-123', ['--continue', '--verbose']);
    expect(result).toEqual(['--resume', 'session-123', '--verbose']);
  });

  it('handles empty original args', () => {
    const result = buildResumeArgs('session-123', []);
    expect(result).toEqual(['--resume', 'session-123']);
  });
});

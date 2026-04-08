import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  execPath: string;
  originalArgs: string[];
  permissionMode: string;
  invocationCmd?: string;
}

function encodeCwd(cwd: string): string {
  return cwd.replace(/[:\\/]/g, '-').replace(/^-/, '');
}

function getProjectsDir(): string {
  return path.join(os.homedir(), '.claude', 'projects');
}

function findNewestJsonl(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].name : null;
}

function extractSessionIdFromFilename(filename: string): string {
  return filename.replace(/\.jsonl$/, '');
}

interface JsonlFirstLine {
  sessionId?: string;
  permissionMode?: string;
}

function readFirstJsonlLine(filePath: string): JsonlFirstLine | null {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const firstLine = content.split('\n')[0]?.trim();
  if (!firstLine) return null;

  try {
    return JSON.parse(firstLine) as JsonlFirstLine;
  } catch {
    return null;
  }
}

export function resolveSessionId(cwdOverride?: string): string {
  // Strategy 1: environment variable
  const envId = process.env.CLAUDE_SESSION_ID;
  if (envId) return envId;

  // Strategy 2: newest JSONL in project directory
  const cwd = cwdOverride ?? process.cwd();
  const encoded = encodeCwd(cwd);
  const projectDir = path.join(getProjectsDir(), encoded);
  const newest = findNewestJsonl(projectDir);

  if (newest) {
    return extractSessionIdFromFilename(newest);
  }

  throw new Error(
    `Could not resolve session ID. Set CLAUDE_SESSION_ID or ensure a .jsonl file exists in ${projectDir}`
  );
}

export function readPermissionMode(sessionId: string, cwdOverride?: string): string {
  const cwd = cwdOverride ?? process.cwd();
  const encoded = encodeCwd(cwd);
  const projectDir = path.join(getProjectsDir(), encoded);
  const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);

  const firstLine = readFirstJsonlLine(jsonlPath);
  if (firstLine?.permissionMode) {
    return firstLine.permissionMode;
  }

  return 'default';
}

export { encodeCwd, getProjectsDir, findNewestJsonl, readFirstJsonlLine };

export const EXCLUDED_FLAGS = new Set([
  '--print', '-p',
  '--output-format',
  '--no-session-persistence',
  '--session-id',
  '--continue', '-c',
]);

export function getInvocationJsonPath(sessionId: string): string {
  return path.join(os.homedir(), '.claude', 'session-env', sessionId, 'invocation.json');
}

interface InvocationData {
  cmd: string;
  args: string[];
  capturedAt: string;
  source: string;
}

export function readInvocationJson(sessionId: string): InvocationData | null {
  const filePath = getInvocationJsonPath(sessionId);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as InvocationData;
  } catch {
    return null;
  }
}

function getArgsFromProcessTree(): string[] | null {
  try {
    if (process.platform === 'win32') {
      const output = execSync(
        'wmic process where "name like \'%claude%\'" get ProcessId,CommandLine /format:csv',
        { encoding: 'utf-8', timeout: 5000 }
      );
      const lines = output.trim().split('\n').filter(l => l.includes('claude'));
      if (lines.length > 0) {
        const parts = lines[0].split(',');
        if (parts.length >= 3) {
          const cmdLine = parts.slice(2).join(',').trim();
          const args = cmdLine.split(/\s+/).slice(1);
          return args;
        }
      }
    } else {
      const ppid = process.ppid;
      const output = execSync(`ps -p ${ppid} -o args=`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
      const parts = output.trim().split(/\s+/);
      return parts.slice(1);
    }
  } catch {
    // Process tree inspection failed
  }
  return null;
}

export function stripPrompt(args: string[]): string[] {
  if (args.length === 0) return args;
  const lastArg = args[args.length - 1];
  if (lastArg && !lastArg.startsWith('-')) {
    return args.slice(0, -1);
  }
  return args;
}

export function filterExcludedFlags(args: string[]): string[] {
  const result: string[] = [];
  let skipNext = false;

  for (let i = 0; i < args.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const arg = args[i];
    if (EXCLUDED_FLAGS.has(arg)) {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        skipNext = true;
      }
      continue;
    }

    result.push(arg);
  }

  return result;
}

export function buildResumeArgs(sessionId: string, originalArgs: string[]): string[] {
  const filtered = filterExcludedFlags(originalArgs);
  return ['--resume', sessionId, ...filtered];
}

export async function inspectSession(cwdOverride?: string): Promise<SessionInfo> {
  const cwd = cwdOverride ?? process.cwd();
  const sessionId = resolveSessionId(cwd);
  const permissionMode = readPermissionMode(sessionId, cwd);

  let originalArgs: string[] = [];
  let invocationCmd: string | undefined;

  const invocation = readInvocationJson(sessionId);
  if (invocation) {
    originalArgs = invocation.args;
    invocationCmd = `${invocation.cmd} ${invocation.args.join(' ')}`.trim();
  } else {
    const processArgs = getArgsFromProcessTree();
    if (processArgs) {
      originalArgs = processArgs;
    } else {
      if (permissionMode !== 'default') {
        originalArgs = ['--permission-mode', permissionMode];
      }
    }
  }

  originalArgs = stripPrompt(originalArgs);

  return {
    sessionId,
    cwd,
    execPath: process.execPath,
    originalArgs,
    permissionMode,
    invocationCmd,
  };
}

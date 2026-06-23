import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

function encodeCwd(cwd: string): string {
  return cwd.replace(/[:\\/]/g, '-').replace(/^-/, '');
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

function resolveSessionIdFromProject(): string | null {
  const envId = process.env.CLAUDE_SESSION_ID;
  if (envId) return envId;

  const cwd = process.cwd();
  const encoded = encodeCwd(cwd);
  const projectDir = path.join(os.homedir(), '.claude', 'projects', encoded);
  const newest = findNewestJsonl(projectDir);

  if (newest) {
    return newest.replace(/\.jsonl$/, '');
  }

  return null;
}

interface CapturedInvocation {
  cmd: string;
  args: string[];
  capturedAt: string;
  source: 'wmic' | 'ps' | 'none';
}

function captureFromProcessTree(): { args: string[]; source: 'wmic' | 'ps' } | null {
  try {
    if (process.platform === 'win32') {
      const output = execSync(
        'wmic process where "name like \'%claude%\'" get ProcessId,CommandLine /format:csv',
        { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const lines = output.trim().split('\n').filter(l => l.includes('claude'));
      if (lines.length > 0) {
        const parts = lines[0].split(',');
        if (parts.length >= 3) {
          // WMIC CSV format: Node,ProcessId,CommandLine
          const cmdLine = parts.slice(2).join(',').trim();
          const args = cmdLine.split(/\s+/).slice(1);
          return { args, source: 'wmic' };
        }
      }
    } else {
      const ppid = process.ppid;
      if (ppid) {
        const output = execSync(`ps -p ${ppid} -o args=`, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const parts = output.trim().split(/\s+/);
        return { args: parts.slice(1), source: 'ps' };
      }
    }
  } catch {
    // Silently fail — capture is best-effort
  }
  return null;
}

function main(): void {
  try {
    const sessionId = resolveSessionIdFromProject();
    if (!sessionId) {
      process.exit(0);
    }

    const outputDir = path.join(os.homedir(), '.claude', 'session-env', sessionId);
    const outputPath = path.join(outputDir, 'invocation.json');

    const captured = captureFromProcessTree();

    const invocation: CapturedInvocation = {
      cmd: 'claude',
      args: captured?.args ?? [],
      capturedAt: new Date().toISOString(),
      source: captured?.source ?? 'none',
    };

    fs.mkdirSync(outputDir, { recursive: true });
    // Use 'wx' (exclusive create) to atomically check-and-write in one syscall,
    // eliminating the TOCTOU race between existsSync and writeFileSync.
    // If the file already exists, EEXIST is thrown and caught below — identical
    // to the previous "exit 0 if already captured" logic.
    fs.writeFileSync(outputPath, JSON.stringify(invocation, null, 2), { encoding: 'utf-8', flag: 'wx' });
  } catch {
    // Hook errors must never block session start
  }

  process.exit(0);
}

main();

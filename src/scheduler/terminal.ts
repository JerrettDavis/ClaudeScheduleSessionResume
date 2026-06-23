import { spawn, execSync } from 'child_process';

function isCommandAvailable(cmd: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${cmd}`, { stdio: 'pipe', timeout: 3000 });
    } else {
      execSync(`which ${cmd}`, { stdio: 'pipe', timeout: 3000 });
    }
    return true;
  } catch {
    return false;
  }
}

function launchWindows(cmd: string): void {
  // Try Windows Terminal first
  if (isCommandAvailable('wt')) {
    spawn('wt', ['new-tab', 'pwsh', '-NoExit', '-Command', cmd], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  // Fallback to PowerShell Start-Process
  const escapedCmd = cmd.replace(/'/g, "''");
  spawn(
    'powershell',
    ['-Command', `Start-Process pwsh -ArgumentList '-NoExit', '-Command', '${escapedCmd}'`],
    { detached: true, stdio: 'ignore' }
  ).unref();
}

function launchMacOS(cmd: string): void {
  // Escape all characters that are special inside an AppleScript double-quoted string:
  // backslash first (must be first to avoid double-escaping), then double-quote.
  // Additional AppleScript metacharacters (\n, \r, \t) are also escaped globally.
  const escapedCmd = cmd
    .replace(/\\/g, '\\\\')   // backslash → \\  (must be first)
    .replace(/"/g, '\\"')      // " → \"
    .replace(/\r/g, '\\r')     // CR
    .replace(/\n/g, '\\n')     // LF
    .replace(/\t/g, '\\t');    // tab
  spawn(
    'osascript',
    ['-e', `tell application "Terminal" to do script "${escapedCmd}"`],
    { detached: true, stdio: 'ignore' }
  ).unref();
}

function launchLinux(cmd: string): void {
  const terminals = [
    { bin: 'gnome-terminal', args: ['--', 'bash', '-c', `${cmd}; exec bash`] },
    { bin: 'xterm', args: ['-e', cmd] },
    { bin: 'konsole', args: ['-e', cmd] },
  ];

  for (const terminal of terminals) {
    if (isCommandAvailable(terminal.bin)) {
      spawn(terminal.bin, terminal.args, {
        detached: true,
        stdio: 'ignore',
      }).unref();
      return;
    }
  }

  throw new Error(
    'No supported terminal emulator found. Install gnome-terminal, xterm, or konsole.'
  );
}

export function launchTerminal(cmd: string): void {
  switch (process.platform) {
    case 'win32':
      launchWindows(cmd);
      break;
    case 'darwin':
      launchMacOS(cmd);
      break;
    default:
      launchLinux(cmd);
      break;
  }
}

export { isCommandAvailable, launchWindows, launchMacOS, launchLinux };

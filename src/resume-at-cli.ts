#!/usr/bin/env node

import { parseTime } from './time/parser';
import { inspectSession, buildResumeArgs } from './session/inspector';
import { scheduleResume, cancelResume, listPending, PendingSchedule } from './scheduler/scheduler';
import { registerOsTask } from './scheduler/os-fallback';
import * as path from 'path';

function getPluginRoot(): string {
  // bin/resume-at-cli.js → plugin root is parent of bin/
  return path.resolve(__dirname, '..');
}

function formatScheduleTable(schedules: PendingSchedule[]): string {
  if (schedules.length === 0) {
    return 'No pending schedules.';
  }

  const lines: string[] = ['Pending schedules:', ''];

  for (const s of schedules) {
    const target = new Date(s.targetMs);
    const remaining = s.targetMs - Date.now();
    const remainingStr = remaining > 0
      ? formatRemainingMs(remaining)
      : 'EXPIRED';

    lines.push(`  Session: ${s.sessionId}`);
    lines.push(`  Target:  ${target.toLocaleString()}`);
    lines.push(`  Remaining: ${remainingStr}`);
    lines.push(`  Command: claude ${s.args.join(' ')}`);
    lines.push(`  CWD:     ${s.cwd}`);
    if (s.prompt) lines.push(`  Prompt:  ${s.prompt}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatRemainingMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

async function handleCancel(): Promise<void> {
  try {
    const session = await inspectSession();
    const cancelled = await cancelResume(session.sessionId);

    if (cancelled) {
      // lgtm[js/clear-text-logging] sessionId is a non-secret Claude Code UUID, not a credential
      console.log(`Cancelled scheduled resume for session ${session.sessionId}`);
    } else {
      // lgtm[js/clear-text-logging] sessionId is a non-secret Claude Code UUID, not a credential
      console.log(`No pending schedule found for session ${session.sessionId}`);
    }
  } catch (err) {
    console.error(`Error cancelling schedule: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function handleList(): void {
  const schedules = listPending();
  console.log(formatScheduleTable(schedules));
}

async function handleSchedule(timeStr: string, prompt?: string): Promise<void> {
  try {
    const parsed = parseTime(timeStr);
    const session = await inspectSession();
    const args = buildResumeArgs(session.sessionId, session.originalArgs);

    const pending: PendingSchedule = {
      sessionId: session.sessionId,
      targetMs: parsed.targetDate.getTime(),
      execPath: session.execPath,
      args,
      cwd: session.cwd,
      prompt,
      createdAt: new Date().toISOString(),
    };

    const pluginRoot = getPluginRoot();
    const result = await scheduleResume(pending, pluginRoot);

    if (result.replaced) {
      console.log('Replaced existing schedule for this session.');
    }

    console.log(`Session will resume ${parsed.humanLabel}`);
    // lgtm[js/clear-text-logging] args contain --resume <uuid> — non-sensitive operational status shown to the CLI user
    console.log(`  Run command: claude ${args.join(' ')}`);
    console.log(`  Working dir: ${session.cwd}`);
    if (prompt) {
      console.log(`  Prompt: ${prompt}`);
    }

    // Try OS fallback if watcher spawn failed
    if (result.watcherFailed) {
      console.log('  Note: Watcher process failed to start. Attempting OS-level fallback...');
      try {
        registerOsTask(pending);
        console.log('  OS scheduled task created as backup.');
      } catch (err) {
        console.error(`  Warning: OS fallback also failed: ${err instanceof Error ? err.message : String(err)}`);
        console.error('  The resume may not fire. Try closing and re-running the plugin.');
      }
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    console.error(
      'Usage: resume-at <time> [prompt]\n' +
      '       resume-at cancel\n' +
      '       resume-at list\n\n' +
      'Time formats:\n' +
      '  Duration:  5h, 2h30m, 90m, 45s\n' +
      '  Time:      5pm, 5:00pm, 17:00, 1700\n' +
      '  Datetime:  2026-04-07T21:00:00\n\n' +
      'Examples:\n' +
      '  resume-at 2h\n' +
      '  resume-at 5pm "check the build"\n' +
      '  resume-at cancel\n' +
      '  resume-at list'
    );
    process.exit(1);
  }

  const subcommand = argv[0];

  if (subcommand === 'cancel') {
    await handleCancel();
  } else if (subcommand === 'list') {
    await handleList();
  } else {
    const prompt = argv[1]; // optional
    await handleSchedule(subcommand, prompt);
  }
}

main();

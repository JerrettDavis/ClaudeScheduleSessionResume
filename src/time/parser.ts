export interface ParsedTime {
  targetDate: Date;
  humanLabel: string;
}

function formatTime12h(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

function formatDuration(ms: number): string {
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

function advanceToNextDayIfPast(date: Date, now: Date): Date {
  if (date.getTime() <= now.getTime()) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function tryParseISO(input: string, _now: Date): ParsedTime | null {
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  if (!isoPattern.test(input)) return null;

  const date = new Date(input);
  if (isNaN(date.getTime())) return null;

  const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${formatTime12h(date)}`;
  return {
    targetDate: date,
    humanLabel: `at ${formatted}`,
  };
}

function tryParseDuration(input: string, now: Date): ParsedTime | null {
  const durationPattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = input.match(durationPattern);
  if (!match) return null;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours === 0 && minutes === 0 && seconds === 0) return null;

  const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const targetDate = new Date(now.getTime() + ms);

  return {
    targetDate,
    humanLabel: `in ${formatDuration(ms)} (${formatTime12h(targetDate)})`,
  };
}

function tryParseMilitary(input: string, now: Date): ParsedTime | null {
  const militaryPattern = /^([01]\d|2[0-3])([0-5]\d)$/;
  const match = input.match(militaryPattern);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  advanceToNextDayIfPast(target, now);

  const durationMs = target.getTime() - now.getTime();
  return {
    targetDate: target,
    humanLabel: `at ${formatTime12h(target)} (in ${formatDuration(durationMs)})`,
  };
}

function tryParse24Hour(input: string, now: Date): ParsedTime | null {
  const pattern24 = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const match = input.match(pattern24);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  advanceToNextDayIfPast(target, now);

  const durationMs = target.getTime() - now.getTime();
  return {
    targetDate: target,
    humanLabel: `at ${formatTime12h(target)} (in ${formatDuration(durationMs)})`,
  };
}

function tryParse12Hour(input: string, now: Date): ParsedTime | null {
  const pattern12 = /^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)$/i;
  const match = input.match(pattern12);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2] || '0', 10);
  const meridiem = match[3].toLowerCase();

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  advanceToNextDayIfPast(target, now);

  const durationMs = target.getTime() - now.getTime();
  return {
    targetDate: target,
    humanLabel: `at ${formatTime12h(target)} (in ${formatDuration(durationMs)})`,
  };
}

const parsers = [
  tryParseISO,
  tryParseDuration,
  tryParseMilitary,
  tryParse24Hour,
  tryParse12Hour,
];

export function parseTime(input: string, now?: Date): ParsedTime {
  const trimmed = input.trim();
  const currentTime = now ?? new Date();

  for (const parser of parsers) {
    const result = parser(trimmed, currentTime);
    if (result) return result;
  }

  throw new Error(
    `Invalid time format: "${input}". Valid formats:\n` +
    `  Duration:  5h, 2h30m, 90m, 45s\n` +
    `  Time:      5pm, 5:00pm, 17:00, 1700\n` +
    `  Datetime:  2026-04-07T21:00:00`
  );
}

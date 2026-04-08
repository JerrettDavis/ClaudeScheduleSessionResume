import { describe, it, expect } from 'vitest';
import { parseTime } from './parser';

describe('parseTime', () => {
  // Fixed "now" for deterministic tests: April 7, 2026, 2:00 PM local time
  const now = new Date(2026, 3, 7, 14, 0, 0, 0);

  describe('ISO 8601', () => {
    it('parses full ISO datetime', () => {
      const result = parseTime('2026-04-07T21:00:00', now);
      expect(result.targetDate.getHours()).toBe(21);
      expect(result.targetDate.getMinutes()).toBe(0);
      expect(result.humanLabel).toContain('at');
      expect(result.humanLabel).toContain('9:00 PM');
    });

    it('parses ISO with minutes', () => {
      const result = parseTime('2026-04-08T09:30:00', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(9);
      expect(result.targetDate.getMinutes()).toBe(30);
    });

    it('rejects invalid ISO date', () => {
      expect(() => parseTime('2026-13-07T21:00:00', now)).toThrow('Invalid time format');
    });

    it('throws on past ISO datetime', () => {
      expect(() => parseTime('2020-01-01T00:00:00', now)).toThrow('is in the past');
    });
  });

  describe('Duration', () => {
    it('parses hours only', () => {
      const result = parseTime('2h', now);
      expect(result.targetDate.getHours()).toBe(16);
      expect(result.humanLabel).toContain('in 2h');
      expect(result.humanLabel).toContain('4:00 PM');
    });

    it('parses minutes only', () => {
      const result = parseTime('30m', now);
      expect(result.targetDate.getHours()).toBe(14);
      expect(result.targetDate.getMinutes()).toBe(30);
      expect(result.humanLabel).toContain('in 30m');
    });

    it('parses seconds only', () => {
      const result = parseTime('45s', now);
      expect(result.targetDate.getSeconds()).toBe(45);
      expect(result.humanLabel).toContain('in 45s');
    });

    it('parses combined hours and minutes', () => {
      const result = parseTime('2h30m', now);
      expect(result.targetDate.getHours()).toBe(16);
      expect(result.targetDate.getMinutes()).toBe(30);
      expect(result.humanLabel).toContain('in 2h 30m');
    });

    it('parses combined hours, minutes, and seconds', () => {
      const result = parseTime('1h15m30s', now);
      expect(result.targetDate.getHours()).toBe(15);
      expect(result.targetDate.getMinutes()).toBe(15);
    });

    it('includes seconds in label when combined with hours', () => {
      const result = parseTime('1h30s', now);
      expect(result.humanLabel).toContain('1h');
      expect(result.humanLabel).toContain('30s');
    });

    it('rejects zero duration', () => {
      expect(() => parseTime('0h0m0s', now)).toThrow('Invalid time format');
    });
  });

  describe('Military time (4 digits)', () => {
    it('parses future military time today', () => {
      const result = parseTime('1700', now);
      expect(result.targetDate.getDate()).toBe(7);
      expect(result.targetDate.getHours()).toBe(17);
      expect(result.targetDate.getMinutes()).toBe(0);
      expect(result.humanLabel).toContain('5:00 PM');
    });

    it('parses midnight as next day', () => {
      const result = parseTime('0000', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(0);
    });

    it('advances past military time to next day', () => {
      const result = parseTime('1300', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(13);
    });

    it('parses 2359', () => {
      const result = parseTime('2359', now);
      expect(result.targetDate.getHours()).toBe(23);
      expect(result.targetDate.getMinutes()).toBe(59);
    });
  });

  describe('24-hour time (HH:MM)', () => {
    it('parses future 24-hour time', () => {
      const result = parseTime('17:00', now);
      expect(result.targetDate.getHours()).toBe(17);
      expect(result.humanLabel).toContain('5:00 PM');
    });

    it('parses single-digit hour', () => {
      const result = parseTime('9:30', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(9);
      expect(result.targetDate.getMinutes()).toBe(30);
    });

    it('advances past 24-hour time to next day', () => {
      const result = parseTime('13:00', now);
      expect(result.targetDate.getDate()).toBe(8);
    });
  });

  describe('12-hour time', () => {
    it('parses PM time', () => {
      const result = parseTime('5pm', now);
      expect(result.targetDate.getHours()).toBe(17);
      expect(result.humanLabel).toContain('5:00 PM');
    });

    it('parses PM time with minutes', () => {
      const result = parseTime('5:30pm', now);
      expect(result.targetDate.getHours()).toBe(17);
      expect(result.targetDate.getMinutes()).toBe(30);
    });

    it('parses AM time (advances to next day)', () => {
      const result = parseTime('9am', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(9);
    });

    it('parses 12pm as noon', () => {
      const result = parseTime('12pm', now);
      expect(result.targetDate.getDate()).toBe(8);
      expect(result.targetDate.getHours()).toBe(12);
    });

    it('parses 12am as midnight', () => {
      const result = parseTime('12am', now);
      expect(result.targetDate.getHours()).toBe(0);
      expect(result.targetDate.getDate()).toBe(8);
    });

    it('is case insensitive', () => {
      const result = parseTime('5PM', now);
      expect(result.targetDate.getHours()).toBe(17);
    });

    it('parses with space before meridiem', () => {
      const result = parseTime('5:30 pm', now);
      expect(result.targetDate.getHours()).toBe(17);
      expect(result.targetDate.getMinutes()).toBe(30);
    });
  });

  describe('Error handling', () => {
    it('throws on empty string', () => {
      expect(() => parseTime('', now)).toThrow('Invalid time format');
    });

    it('throws on random text', () => {
      expect(() => parseTime('notavalidtime', now)).toThrow('Invalid time format');
    });

    it('throws on partial format', () => {
      expect(() => parseTime('25:00', now)).toThrow('Invalid time format');
    });

    it('error message includes examples', () => {
      try {
        parseTime('bad', now);
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain('5h');
        expect(msg).toContain('5pm');
        expect(msg).toContain('17:00');
      }
    });
  });

  describe('humanLabel format', () => {
    it('duration label includes relative and absolute time', () => {
      const result = parseTime('2h30m', now);
      expect(result.humanLabel).toMatch(/^in \d+h \d+m \(/);
      expect(result.humanLabel).toMatch(/\d+:\d+ [AP]M\)$/);
    });

    it('time-of-day label includes absolute and relative time', () => {
      const result = parseTime('5pm', now);
      expect(result.humanLabel).toMatch(/^at \d+:\d+ [AP]M \(in /);
      expect(result.humanLabel).toMatch(/\)$/);
    });

    it('ISO label includes full date and time', () => {
      const result = parseTime('2026-04-07T21:00:00', now);
      expect(result.humanLabel).toMatch(/^at 2026-04-07 9:00 PM$/);
    });
  });
});

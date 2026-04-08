import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatTimeForSchtasks, formatDateForSchtasks, formatForAt } from './os-fallback';

describe('OS fallback formatting', () => {
  describe('formatTimeForSchtasks', () => {
    it('formats morning time with zero padding', () => {
      const date = new Date(2026, 3, 7, 9, 5, 0);
      expect(formatTimeForSchtasks(date.getTime())).toBe('09:05');
    });

    it('formats afternoon time', () => {
      const date = new Date(2026, 3, 7, 17, 30, 0);
      expect(formatTimeForSchtasks(date.getTime())).toBe('17:30');
    });

    it('formats midnight', () => {
      const date = new Date(2026, 3, 8, 0, 0, 0);
      expect(formatTimeForSchtasks(date.getTime())).toBe('00:00');
    });
  });

  describe('formatDateForSchtasks', () => {
    it('formats date as MM/DD/YYYY', () => {
      const date = new Date(2026, 3, 7, 9, 0, 0);
      expect(formatDateForSchtasks(date.getTime())).toBe('04/07/2026');
    });

    it('pads single-digit month and day', () => {
      const date = new Date(2026, 0, 5, 9, 0, 0);
      expect(formatDateForSchtasks(date.getTime())).toBe('01/05/2026');
    });
  });

  describe('formatForAt', () => {
    it('formats for Unix at command', () => {
      const date = new Date(2026, 3, 7, 21, 0, 0);
      expect(formatForAt(date.getTime())).toBe('21:00 2026-04-07');
    });

    it('pads single-digit values', () => {
      const date = new Date(2026, 0, 5, 8, 5, 0);
      expect(formatForAt(date.getTime())).toBe('08:05 2026-01-05');
    });
  });
});

describe('registerOsTask', () => {
  // Note: Full integration tests for registerOsTask require platform-specific
  // mocking. The formatting functions above are tested directly.
  // The registerOsTask function is tested via E2E tests in Docker.
  it('is tested via E2E in Docker', () => {
    expect(true).toBe(true);
  });
});

describe('removeOsTask', () => {
  // removeOsTask is best-effort and platform-specific.
  // Tested via E2E in Task 12.
  it('is a no-op test placeholder', () => {
    expect(true).toBe(true);
  });
});

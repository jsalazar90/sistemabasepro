import { describe, it, expect } from 'vitest';
import { 
  formatDate, 
  toInputDateFormat, 
  getTodayLocalDate, 
  addDaysToDate 
} from './dateUtils';

describe('dateUtils utility suite', () => {
  describe('formatDate', () => {
    it('returns empty string for falsy input', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('preserves already formatted DD/MM/YYYY dates', () => {
      expect(formatDate('15/09/2026')).toBe('15/09/2026');
    });

    it('formats ISO YYYY-MM-DD dates to DD/MM/YYYY', () => {
      expect(formatDate('2026-09-15')).toBe('15/09/2026');
      expect(formatDate('2026-01-05')).toBe('05/01/2026');
    });

    it('strips ISO timestamp before formatting', () => {
      expect(formatDate('2026-09-15T14:30:00.000Z')).toBe('15/09/2026');
    });
  });

  describe('toInputDateFormat', () => {
    it('returns YYYY-MM-DD from Date object', () => {
      const d = new Date(2026, 8, 15); // Sept 15, 2026
      expect(toInputDateFormat(d)).toBe('2026-09-15');
    });

    it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
      expect(toInputDateFormat('15/09/2026')).toBe('2026-09-15');
    });

    it('preserves already formatted YYYY-MM-DD string', () => {
      expect(toInputDateFormat('2026-09-15')).toBe('2026-09-15');
    });
  });

  describe('addDaysToDate', () => {
    it('adds positive days correctly', () => {
      expect(addDaysToDate('2026-09-15', 5)).toBe('2026-09-20');
      expect(addDaysToDate('2026-09-28', 5)).toBe('2026-10-03');
    });

    it('handles leap years and month transitions', () => {
      expect(addDaysToDate('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDaysToDate('2028-02-28', 2)).toBe('2028-03-01');
    });
  });
});

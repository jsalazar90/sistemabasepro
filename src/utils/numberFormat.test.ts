import { describe, it, expect } from 'vitest';
import { 
  parseMoney, 
  formatNumber, 
  formatMoney, 
  formatCorrelativo, 
  formatDocumentNumber, 
  getNextCorrelativo 
} from './numberFormat';

describe('numberFormat utility suite', () => {
  describe('parseMoney', () => {
    it('handles null, undefined and empty string as 0', () => {
      expect(parseMoney(null)).toBe(0);
      expect(parseMoney(undefined)).toBe(0);
      expect(parseMoney('')).toBe(0);
    });

    it('parses numeric values correctly', () => {
      expect(parseMoney(123.45)).toBe(123.45);
      expect(parseMoney(0)).toBe(0);
    });

    it('parses European/Latin comma formatted strings', () => {
      expect(parseMoney('1.234,56')).toBe(1234.56);
      expect(parseMoney('500,00')).toBe(500);
      expect(parseMoney('12,5')).toBe(12.5);
    });

    it('parses US dot formatted strings', () => {
      expect(parseMoney('1,234.56')).toBe(1234.56);
      expect(parseMoney('500.00')).toBe(500);
    });
  });

  describe('formatNumber & formatMoney', () => {
    it('formats thousands with dots and decimals with comma', () => {
      expect(formatNumber(1234567.89)).toBe('1.234.567,89');
      expect(formatNumber(0)).toBe('0,00');
      expect(formatNumber(100, 0)).toBe('100');
    });

    it('prepends currency symbol when provided', () => {
      expect(formatMoney(1500, '$')).toBe('$ 1.500,00');
      expect(formatMoney(2500.5, 'Bs.')).toBe('Bs. 2.500,50');
    });
  });

  describe('correlativo formatting & atomic series', () => {
    it('pads correlativo with 6 digits by default', () => {
      expect(formatCorrelativo(1)).toBe('000001');
      expect(formatCorrelativo('45')).toBe('000045');
      expect(formatCorrelativo(null)).toBe('000001');
    });

    it('preserves longer padding if input has more digits', () => {
      expect(formatCorrelativo('0000000123')).toBe('0000000123');
    });

    it('formats document number with clean prefix', () => {
      expect(formatDocumentNumber('FAC', '1')).toBe('FAC-000001');
      expect(formatDocumentNumber('FAC-', '5')).toBe('FAC-000005');
      expect(formatDocumentNumber('', '12')).toBe('000012');
      expect(formatDocumentNumber(null, '99')).toBe('000099');
    });

    it('increments correlativo preserving length', () => {
      expect(getNextCorrelativo('000001')).toBe('000002');
      expect(getNextCorrelativo('000999')).toBe('001000');
      expect(getNextCorrelativo('00000001', 8)).toBe('00000002');
    });
  });
});

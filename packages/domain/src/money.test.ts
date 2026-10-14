import { describe, expect, it } from 'vitest';
import { subtractAmounts } from './index.js';
describe('decimal amount differences', () => {
  it('retains cents without binary floating point errors', () => {
    expect(subtractAmounts('0.30', '0.20')).toBe('0.1');
  });
  it('calculates the pickup discrepancy without claiming its cause', () => {
    expect(subtractAmounts('212', '150')).toBe('62');
  });
  it('rejects non-decimal and non-finite input', () => {
    for (const value of ['NaN', 'Infinity', '1e3', ''])
      expect(() => subtractAmounts(value, '1')).toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { normalizeForMatch, editDistance, resolveDistrict, resolveState } from '@/lib/geo';

describe('normalizeForMatch', () => {
  it('lowercases, trims, collapses ws, strips non-alphanumeric', () => {
    expect(normalizeForMatch('  Thri ssur. ')).toBe('thrissur');
    expect(normalizeForMatch('THRISSUR')).toBe('thrissur');
    expect(normalizeForMatch('Tamil-Nadu')).toBe('tamilnadu');
  });
});

describe('editDistance', () => {
  it('computes Levenshtein', () => {
    expect(editDistance('thrisur', 'thrissur')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
  });
});

describe('resolveDistrict', () => {
  it('exact (case/space/punct insensitive)', () => {
    expect(resolveDistrict('KERALA', 'thriSSur')).toEqual({ status: 'exact', value: 'Thrissur' });
    expect(resolveDistrict('Kerala', 'Ernakulam')).toEqual({ status: 'exact', value: 'Ernakulam' });
  });
  it('corrected on a single close typo (<=2)', () => {
    expect(resolveDistrict('KERALA', 'thrisur')).toEqual({ status: 'corrected', value: 'Thrissur' });
  });
  it('empty district -> none', () => {
    expect(resolveDistrict('KERALA', '')).toEqual({ status: 'none', value: '' });
  });
  it('no match within threshold -> unknown (raw kept)', () => {
    expect(resolveDistrict('KERALA', 'Zzzzville')).toEqual({ status: 'unknown', value: 'Zzzzville' });
  });
  it('non-real state cannot resolve a district -> unknown', () => {
    expect(resolveDistrict('ALL', 'Anything')).toEqual({ status: 'unknown', value: 'Anything' });
    expect(resolveDistrict('', 'Anything')).toEqual({ status: 'unknown', value: 'Anything' });
  });
});

describe('resolveState', () => {
  it('exact by value or label', () => {
    expect(resolveState('TAMIL_NADU')).toEqual({ status: 'exact', value: 'TAMIL_NADU' });
    expect(resolveState('Tamil Nadu')).toEqual({ status: 'exact', value: 'TAMIL_NADU' });
    expect(resolveState('all')).toEqual({ status: 'exact', value: 'ALL' });
  });
  it('corrected on typo', () => {
    expect(resolveState('Kerela')).toEqual({ status: 'corrected', value: 'KERALA' });
  });
  it('empty -> none, junk -> unknown', () => {
    expect(resolveState('')).toEqual({ status: 'none', value: '' });
    expect(resolveState('Atlantis')).toEqual({ status: 'unknown', value: 'Atlantis' });
  });
});

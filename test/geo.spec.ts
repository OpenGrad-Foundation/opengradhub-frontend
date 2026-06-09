import { describe, it, expect } from 'vitest';
import {
  STATES,
  STATE_DISTRICTS,
  ALL_STATE,
  normState,
  districtsForState,
  districtDisabled,
  isKnownState,
  isValidDistrictForState,
} from '@/lib/geo';

describe('geo', () => {
  it('STATES includes the four states plus ALL, in that order', () => {
    expect(STATES.map((s) => s.value)).toEqual([
      'KERALA', 'KARNATAKA', 'TAMIL_NADU', 'CHHATTISGARH', 'ALL',
    ]);
  });

  it('every real state has a non-empty district list; ALL has none', () => {
    expect(STATE_DISTRICTS.KERALA.length).toBe(14);
    expect(STATE_DISTRICTS.KARNATAKA.length).toBeGreaterThan(0);
    expect(STATE_DISTRICTS.TAMIL_NADU.length).toBeGreaterThan(0);
    expect(STATE_DISTRICTS.CHHATTISGARH.length).toBeGreaterThan(0);
    expect(STATE_DISTRICTS[ALL_STATE]).toEqual([]);
  });

  it('normState upper-cases and underscores', () => {
    expect(normState('Tamil Nadu')).toBe('TAMIL_NADU');
    expect(normState('  kerala ')).toBe('KERALA');
    expect(normState(null)).toBe('');
  });

  it('districtsForState returns the list for a state and [] for ALL/unknown', () => {
    expect(districtsForState('KERALA')).toContain('Ernakulam');
    expect(districtsForState('Tamil Nadu')).toContain('Chennai');
    expect(districtsForState('ALL')).toEqual([]);
    expect(districtsForState('NARNIA')).toEqual([]);
    expect(districtsForState('')).toEqual([]);
  });

  it('districtDisabled is true for empty and ALL, false for real states', () => {
    expect(districtDisabled('')).toBe(true);
    expect(districtDisabled('ALL')).toBe(true);
    expect(districtDisabled('KERALA')).toBe(false);
  });

  it('isKnownState excludes ALL and empty', () => {
    expect(isKnownState('KERALA')).toBe(true);
    expect(isKnownState('ALL')).toBe(false);
    expect(isKnownState('')).toBe(false);
    expect(isKnownState('NARNIA')).toBe(false);
  });

  it('isValidDistrictForState checks membership', () => {
    expect(isValidDistrictForState('KERALA', 'Ernakulam')).toBe(true);
    expect(isValidDistrictForState('KERALA', 'Chennai')).toBe(false);
    expect(isValidDistrictForState('ALL', 'Anything')).toBe(false);
  });
});

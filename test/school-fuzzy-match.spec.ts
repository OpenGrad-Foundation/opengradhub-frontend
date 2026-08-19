import { describe, it, expect } from 'vitest';
import type { SchoolOption } from '@/lib/api';
import { matchSchoolGuess } from '@/lib/school-fuzzy-match';

function school(over: Partial<SchoolOption> & { id: string; name: string }): SchoolOption {
  return { state: null, district: null, code: null, fellow_id: null, fellow_name: null, ...over };
}

const SCHOOLS: SchoolOption[] = [
  school({ id: 's1', name: 'Green Valley High', code: 'GVH-01' }),
  school({ id: 's2', name: 'Hilltop Academy', code: 'HTA-03' }),
];

describe('matchSchoolGuess', () => {
  it('returns null for a null guess', () => {
    expect(matchSchoolGuess(null, SCHOOLS)).toBeNull();
  });

  it('matches an exact (case/space-insensitive) name', () => {
    expect(matchSchoolGuess('  green   VALLEY high ', SCHOOLS)?.id).toBe('s1');
  });

  it('matches a single-typo name', () => {
    expect(matchSchoolGuess('Green Valey High', SCHOOLS)?.id).toBe('s1');
  });

  it('matches an exact code', () => {
    expect(matchSchoolGuess('HTA-03', SCHOOLS)?.id).toBe('s2');
  });

  it('returns null when no school is close enough', () => {
    expect(matchSchoolGuess('Totally Different School', SCHOOLS)).toBeNull();
  });

  it('returns null on an ambiguous match against two similarly-named schools', () => {
    const ambiguous: SchoolOption[] = [
      school({ id: 's3', name: 'Ravi Public School' }),
      school({ id: 's4', name: 'Ravi Public Schoal' }),
    ];
    expect(matchSchoolGuess('Ravi Public Schoo', ambiguous)).toBeNull();
  });
});

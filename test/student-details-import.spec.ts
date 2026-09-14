import { describe, it, expect } from 'vitest';
import { parseStudentCsv, buildStudentImport } from '@/lib/student-details-import';

describe('student details CSV preparation', () => {
  it('preserves leading zeroes, quoted commas, multiline cells and original row positions', () => {
    const csv = parseStudentCsv('\uFEFFRoll,Phone,Note\r\n001,0091,"Hello, there"\r\n,,\r\n002,0002,"Two\nlines"');
    expect(csv.headers).toEqual(['Roll', 'Phone', 'Note']);
    expect(csv.rows).toEqual([
      { row_number: 2, cells: ['001', '0091', 'Hello, there'] },
      { row_number: 4, cells: ['002', '0002', 'Two\nlines'] },
    ]);
  });
  it('rejects ambiguous headers, malformed CSV, mismatched widths and excessive rows', () => {
    for (const csv of ['Roll, Roll\n1,2', 'Roll,\n1,2', 'Roll,Phone\n1,"unterminated', 'Roll,Phone\n1,2,3', 'Roll,Phone\n',
      'Roll,Phone\n' + Array(1001).fill('1,2').join('\n')]) expect(() => parseStudentCsv(csv)).toThrow();
  });
  it('sends only mapped fields, identifies each row separately, and preserves blanks', () => {
    const csv = parseStudentCsv('Roll,Phone,Ignore\n001,0091,private\n002,,discard');
    expect(buildStudentImport(csv, { '1': 'parent_phone' }, 0, 'roll_number', false)).toEqual({
      identifier_type: 'roll_number', overwrite: false, rows: [
        { row_number: 2, identifier: '001', values: { parent_phone: '0091' } },
        { row_number: 3, identifier: '002', values: { parent_phone: '' } },
      ],
    });
  });
  it('requires a valid key and unique field mapping', () => {
    const csv = parseStudentCsv('Roll,A,B\n1,x,y');
    expect(() => buildStudentImport(csv, {}, 0, 'roll_number', false)).toThrow();
    expect(() => buildStudentImport(csv, { '1': 'phone', '2': 'phone' }, 0, 'roll_number', false)).toThrow();
    expect(() => buildStudentImport(csv, { '1': 'phone' }, -1, 'roll_number', false)).toThrow();
  });
});

import { describe, it, expect, vi } from 'vitest';
import type { TrackerField, TrackerGridRow } from '@/lib/tracker-api';
import {
  buildExportRows, buildHeaders, escapeSpreadsheetValue, parseCellValue, serializeCellValue,
  unescapeSpreadsheetValue,
} from '@/lib/tracker-bulk-fill';
import { cellText } from '@/lib/tracker-bulk-file';
import { buildFailedRows, prepareUpload, submittableEdits } from '@/lib/tracker-bulk-validate';
import { submitBulkEdits } from '@/lib/tracker-bulk-submit';

const field = (over: Partial<TrackerField> & Pick<TrackerField, 'field_key' | 'label' | 'field_type'>): TrackerField => ({
  options: null, source: 'input', source_path: null, required: false, visible_if: null, sort_order: 0, ...over,
});

const TEXT = field({ field_key: 'notes', label: 'Notes', field_type: 'text' });
const NUM = field({ field_key: 'count', label: 'Count', field_type: 'number' });
const DATE = field({ field_key: 'visited', label: 'Visited On', field_type: 'date' });
const BOOL = field({ field_key: 'met', label: 'Met Parent', field_type: 'boolean' });
const SELECT = field({ field_key: 'mode', label: 'Mode', field_type: 'select', options: ['Call', 'Visit'] });
const MULTI = field({ field_key: 'topics', label: 'Topics', field_type: 'multiselect', options: ['Fees', 'Marks', 'Health'] });
const PROFILE = field({ field_key: 'roll', label: 'Roll No', field_type: 'text', source: 'profile', source_path: 'student.roll' });
const IDENTITY = field({ field_key: 'appno', label: 'App No', field_type: 'text', source: 'identity' });

const row = (over: Partial<TrackerGridRow> & Pick<TrackerGridRow, 'record_id'>): TrackerGridRow => ({
  status: 'pending', cells: [], blocked: false, blocker: null,
  school_name: 'Green School', target_name: 'Asha', lifecycle: 'not_started', ...over,
});

const cell = (f: TrackerField, value: unknown) => ({
  field_key: f.field_key, label: f.label, value, locked: f.source === 'profile', notSet: false,
});

describe('serializeCellValue', () => {
  it('packs a multiselect into one cell and reads it back', () => {
    expect(serializeCellValue(MULTI, ['Fees', 'Marks'])).toBe('Fees;Marks');
    expect(parseCellValue(MULTI, 'Fees;Marks')).toEqual({ ok: true, value: ['Fees', 'Marks'] });
  });

  it('writes booleans as words and blanks for missing values', () => {
    expect(serializeCellValue(BOOL, true)).toBe('true');
    expect(serializeCellValue(BOOL, false)).toBe('false');
    expect(serializeCellValue(TEXT, null)).toBe('');
  });
});

describe('escapeSpreadsheetValue', () => {
  it('stops a value being treated as a formula when the file is opened', () => {
    expect(escapeSpreadsheetValue('=1+1')).toBe("'=1+1");
    expect(escapeSpreadsheetValue('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeSpreadsheetValue('-5')).toBe("'-5");
    expect(escapeSpreadsheetValue('Asha')).toBe('Asha');
  });
});

describe('parseCellValue', () => {
  it('accepts the usual ways of writing yes and no', () => {
    for (const yes of ['true', 'TRUE', 'Yes', 'y', '1']) expect(parseCellValue(BOOL, yes)).toEqual({ ok: true, value: true });
    for (const no of ['false', 'No', 'n', '0']) expect(parseCellValue(BOOL, no)).toEqual({ ok: true, value: false });
  });

  it('rejects anything else for a yes/no field', () => {
    const r = parseCellValue(BOOL, 'maybe');
    expect(r.ok).toBe(false);
  });

  it('turns numeric text into a number', () => {
    expect(parseCellValue(NUM, '42')).toEqual({ ok: true, value: 42 });
    expect(parseCellValue(NUM, 'twelve').ok).toBe(false);
  });

  it('only accepts real calendar dates in YYYY-MM-DD form', () => {
    expect(parseCellValue(DATE, '2026-08-04')).toEqual({ ok: true, value: '2026-08-04' });
    expect(parseCellValue(DATE, '2026-02-30').ok).toBe(false);
    expect(parseCellValue(DATE, '04/08/2026').ok).toBe(false);
  });

  it('holds select and multiselect values to the options the task defines', () => {
    expect(parseCellValue(SELECT, 'Visit')).toEqual({ ok: true, value: 'Visit' });
    expect(parseCellValue(SELECT, 'Email').ok).toBe(false);
    expect(parseCellValue(MULTI, 'Fees;Nonsense').ok).toBe(false);
  });

  it('de-duplicates and trims a multiselect cell', () => {
    expect(parseCellValue(MULTI, ' Fees ; Fees ;Marks')).toEqual({ ok: true, value: ['Fees', 'Marks'] });
  });

  it('requires a url to look like one', () => {
    expect(parseCellValue(field({ field_key: 'l', label: 'Link', field_type: 'url' }), 'https://x.com/a').ok).toBe(true);
    expect(parseCellValue(field({ field_key: 'l', label: 'Link', field_type: 'url' }), 'x.com').ok).toBe(false);
  });
});

describe('buildExportRows', () => {
  it('writes a column per editable field, keeping identity fields and dropping profile ones', () => {
    const columns = [PROFILE, IDENTITY, TEXT];
    const rows = [row({ record_id: 'r1', cells: [cell(PROFILE, '12'), cell(IDENTITY, 'A9'), cell(TEXT, 'hi')] })];
    const out = buildExportRows(columns, rows);
    expect(Object.keys(out[0])).toEqual(['record_id', 'Name', 'School', 'Status', 'App No', 'Notes']);
    expect(out[0]['App No']).toBe('A9');
    expect(out[0]['Roll No']).toBeUndefined();
  });

  it('leaves a field blank on rows where it does not apply', () => {
    const columns = [TEXT, SELECT];
    const rows = [
      row({ record_id: 'r1', cells: [cell(TEXT, 'a'), cell(SELECT, 'Call')] }),
      row({ record_id: 'r2', cells: [cell(TEXT, 'b')] }), // Mode hidden here by a visible_if rule
    ];
    const out = buildExportRows(columns, rows);
    expect(out[0].Mode).toBe('Call');
    expect(out[1].Mode).toBe('');
  });

  it('escapes exported values so a spreadsheet does not run them', () => {
    const rows = [row({ record_id: 'r1', target_name: '=cmd()', cells: [cell(TEXT, '=1+1')] })];
    const out = buildExportRows([TEXT], rows);
    expect(out[0].Name).toBe("'=cmd()");
    expect(out[0].Notes).toBe("'=1+1");
  });
});

describe('prepareUpload', () => {
  const columns = [TEXT, SELECT];
  const gridRows = [
    row({ record_id: 'r1', target_name: 'Asha', cells: [cell(TEXT, null), cell(SELECT, null)] }),
    row({ record_id: 'r2', target_name: 'Bina', cells: [cell(TEXT, 'done'), cell(SELECT, 'Call')] }),
  ];
  const headers = ['record_id', 'Name', 'School', 'Status', 'Notes', 'Mode'];

  it('collects only the cells that actually change', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'r1', Name: 'Asha', School: '', Status: '', Notes: 'visited', Mode: 'Visit' },
      { record_id: 'r2', Name: 'Bina', School: '', Status: '', Notes: 'done', Mode: 'Call' },
    ]);
    expect(sheet.fatal).toEqual([]);
    expect(sheet.rows[0].values).toEqual({ notes: 'visited', mode: 'Visit' });
    expect(sheet.rows[1].unchanged).toBe(true);
    expect(submittableEdits(sheet.rows)).toEqual([{ record_id: 'r1', values: { notes: 'visited', mode: 'Visit' } }]);
  });

  it('treats a blank cell as leave it alone, never as clear it', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'r2', Name: 'Bina', School: '', Status: '', Notes: '', Mode: '' },
    ]);
    expect(sheet.rows[0].values).toEqual({});
    expect(submittableEdits(sheet.rows)).toEqual([]);
  });

  it('refuses a file whose columns are not this task', () => {
    const sheet = prepareUpload(columns, gridRows, [...headers, 'Something Else'], []);
    expect(sheet.fatal.join(' ')).toContain('Something Else');
  });

  it('rejects the same record appearing twice, which would undo part of itself', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'first', Mode: '' },
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'second', Mode: '' },
    ]);
    expect(sheet.rows[1].errors[0].message).toContain('already appears on row 2');
    expect(submittableEdits(sheet.rows).some((e) => e.record_id === 'r1' && e.values?.notes === 'second')).toBe(false);
  });

  it('rejects a record that is not in the list being looked at', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'gone', Name: '', School: '', Status: '', Notes: 'x', Mode: '' },
    ]);
    expect(sheet.rows[0].errors).toHaveLength(1);
    expect(submittableEdits(sheet.rows)).toEqual([]);
  });

  it('never writes a field the row does not currently show', () => {
    const hiddenRows = [row({ record_id: 'r1', cells: [cell(TEXT, null)] })]; // Mode not present
    const sheet = prepareUpload(columns, hiddenRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'ok', Mode: 'Visit' },
    ]);
    expect(sheet.rows[0].values).toEqual({ notes: 'ok' });
    expect(sheet.rows[0].warnings[0].message).toContain('does not apply');
  });

  it('flags a required field left empty, which the server would reject for the whole batch', () => {
    const required = field({ field_key: 'mode', label: 'Mode', field_type: 'select', options: ['Call', 'Visit'], required: true });
    const cols = [TEXT, required];
    const rows = [row({ record_id: 'r1', cells: [cell(TEXT, null), cell(required, null)] })];
    const sheet = prepareUpload(cols, rows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'visited', Mode: '' },
    ]);
    expect(sheet.rows[0].errors[0].message).toContain('Mode is required');
    expect(submittableEdits(sheet.rows)).toEqual([]);
  });

  it('warns when the sheet was taken before the row changed', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'r1', Name: 'Old Name', School: '', Status: '', Notes: 'x', Mode: '' },
    ]);
    expect(sheet.rows[0].warnings.some((w) => w.message.includes('Asha'))).toBe(true);
    expect(sheet.rows[0].errors).toEqual([]);
  });

  it('points at a bad cell by the spreadsheet row the user can see', () => {
    const sheet = prepareUpload(columns, gridRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: '', Mode: 'Carrier Pigeon' },
    ]);
    expect(sheet.rows[0].sheetRow).toBe(2);
    expect(sheet.rows[0].errors[0].message).toContain('not one of Call, Visit');
  });
});

describe('submitBulkEdits', () => {
  const edits = (n: number) => Array.from({ length: n }, (_, i) => ({ record_id: `r${i}`, values: { notes: 'x' } }));

  it('saves everything in chunks when nothing fails', async () => {
    const save = vi.fn().mockResolvedValue({});
    const result = await submitBulkEdits(save, edits(60), undefined, 25);
    expect(save).toHaveBeenCalledTimes(3);
    expect(result.savedRecordIds).toHaveLength(60);
    expect(result.failures.size).toBe(0);
  });

  it('narrows a rejected chunk to the row at fault and still saves the rest', async () => {
    const save = vi.fn(async (batch: { record_id: string }[]) => {
      if (batch.some((e) => e.record_id === 'r7')) throw new Error('record r7 out of scope');
      return {};
    });
    const result = await submitBulkEdits(save, edits(10), undefined, 10);
    expect(result.failures.get('r7')).toBe('record r7 out of scope');
    expect(result.savedRecordIds).toHaveLength(9);
    expect(result.savedRecordIds).not.toContain('r7');
  });

  it('isolates a bad row without re-sending it many times over', async () => {
    const save = vi.fn(async (batch: { record_id: string }[]) => {
      if (batch.some((e) => e.record_id === 'r3')) throw new Error('nope');
      return {};
    });
    await submitBulkEdits(save, edits(8), undefined, 8);
    // A linear retry of 8 rows would be 8 further calls; halving keeps it well under that.
    expect(save.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('reports every row when the whole upload is refused', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Forbidden'));
    const result = await submitBulkEdits(save, edits(4), undefined, 4);
    expect(result.savedRecordIds).toEqual([]);
    expect(result.failures.size).toBe(4);
    expect(result.failures.get('r0')).toBe('Forbidden');
  });

  it('counts progress against the number of rows being saved', async () => {
    const save = vi.fn().mockResolvedValue({});
    const seen: number[] = [];
    await submitBulkEdits(save, edits(5), (p) => seen.push(p.attempted), 2);
    expect(seen.at(-1)).toBe(5);
  });

  it('does nothing when there is nothing to save', async () => {
    const save = vi.fn();
    const result = await submitBulkEdits(save, [], undefined, 25);
    expect(save).not.toHaveBeenCalled();
    expect(result.savedRecordIds).toEqual([]);
  });
});

describe('round-tripping a file that came straight out of the grid', () => {
  const columns = [TEXT, NUM, SELECT];
  const headers = buildHeaders(columns);

  it('reads back every escaped value as the value it was built from', () => {
    const rows = [row({
      record_id: 'r1',
      cells: [cell(TEXT, '=SUM(A1)'), cell(NUM, -5), cell(SELECT, 'Call')],
    })];
    const exported = buildExportRows(columns, rows);
    // The file on disk is shielded so a spreadsheet will not execute it...
    expect(exported[0].Notes).toBe("'=SUM(A1)");
    expect(exported[0].Count).toBe("'-5");
    // ...and uploading it untouched is recognised as no change at all.
    const sheet = prepareUpload(columns, rows, headers, exported);
    expect(sheet.fatal).toEqual([]);
    expect(sheet.rows[0].errors).toEqual([]);
    expect(sheet.rows[0].values).toEqual({});
    expect(sheet.rows[0].unchanged).toBe(true);
  });

  it('leaves ordinary text starting with an apostrophe alone', () => {
    expect(unescapeSpreadsheetValue("'quoted")).toBe("'quoted");
    expect(unescapeSpreadsheetValue("'-5")).toBe('-5');
  });

  it('does not count a stored numeric string as a change', () => {
    const rows = [row({ record_id: 'r1', cells: [cell(NUM, '42')] })];
    const sheet = prepareUpload([NUM], rows, ['record_id', 'Name', 'School', 'Status', 'Count'], [
      { record_id: 'r1', Name: '', School: '', Status: '', Count: '42' },
    ]);
    expect(sheet.rows[0].values).toEqual({});
  });
});

describe('column headings', () => {
  it('keeps a field apart from a context column of the same name', () => {
    const named = field({ field_key: 'nickname', label: 'Name', field_type: 'text' });
    const columns = [named];
    const rows = [row({ record_id: 'r1', target_name: 'Asha', cells: [cell(named, 'Ashu')] })];
    const out = buildExportRows(columns, rows);
    expect(out[0].Name).toBe('Asha');            // still the row's identity
    expect(out[0]['Name [nickname]']).toBe('Ashu'); // the field gets its own column
    expect(buildHeaders(columns)).toEqual(['record_id', 'Name', 'School', 'Status', 'Name [nickname]']);
  });

  it('keeps two fields sharing a label apart', () => {
    const a = field({ field_key: 'a', label: 'Marks', field_type: 'number' });
    const b = field({ field_key: 'b', label: 'Marks', field_type: 'number' });
    const rows = [row({ record_id: 'r1', cells: [cell(a, 1), cell(b, 2)] })];
    const out = buildExportRows([a, b], rows);
    expect(out[0]['Marks [a]']).toBe('1');
    expect(out[0]['Marks [b]']).toBe('2');
  });

  it('round-trips a disambiguated column back to the right field', () => {
    const a = field({ field_key: 'a', label: 'Marks', field_type: 'number' });
    const b = field({ field_key: 'b', label: 'Marks', field_type: 'number' });
    const rows = [row({ record_id: 'r1', cells: [cell(a, null), cell(b, null)] })];
    const sheet = prepareUpload([a, b], rows, buildHeaders([a, b]), [
      { record_id: 'r1', Name: '', School: '', Status: '', 'Marks [a]': '7', 'Marks [b]': '9' },
    ]);
    expect(sheet.rows[0].values).toEqual({ a: 7, b: 9 });
  });

  it('refuses a file with the same column twice', () => {
    const sheet = prepareUpload([TEXT], [], ['record_id', 'Notes', 'Notes'], []);
    expect(sheet.fatal.join(' ')).toContain('more than one "Notes" column');
  });
});

describe('options that cannot survive a spreadsheet cell', () => {
  it('refuses to upload for a task whose options contain the separator', () => {
    const bad = field({
      field_key: 'subs', label: 'Subjects', field_type: 'multiselect',
      options: ['Physics; Chemistry', 'Biology'],
    });
    const sheet = prepareUpload([bad], [], ['record_id', 'Name', 'School', 'Status', 'Subjects'], []);
    expect(sheet.fatal.join(' ')).toContain('Physics; Chemistry');
  });
});

describe('buildFailedRows', () => {
  it('rebuilds the rows that failed, escaped, with the reason attached', () => {
    const rows = [row({ record_id: 'r1', target_name: '=bad()', cells: [cell(TEXT, null)] })];
    const sheet = prepareUpload([TEXT], rows, ['record_id', 'Name', 'School', 'Status', 'Notes'], [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'visited' },
    ]);
    const out = buildFailedRows([TEXT], sheet.rows, new Map([['r1', '=cmd()']]));
    expect(out).toHaveLength(1);
    expect(out[0].Name).toBe("'=bad()");
    expect(out[0].Problem).toBe("'=cmd()");
    expect(out[0].Notes).toBe('visited');
  });

  it('leaves out the rows that saved', () => {
    const rows = [row({ record_id: 'r1', cells: [cell(TEXT, null)] })];
    const sheet = prepareUpload([TEXT], rows, ['record_id', 'Name', 'School', 'Status', 'Notes'], [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: 'x' },
    ]);
    expect(buildFailedRows([TEXT], sheet.rows, new Map())).toEqual([]);
  });
});

describe('cellText', () => {
  it('reads an Excel date cell as the day that was typed, whatever the timezone', () => {
    expect(cellText(new Date(2026, 7, 4, 0, 0, 0))).toBe('2026-08-04');
    expect(cellText(new Date(2026, 0, 1, 23, 30, 0))).toBe('2026-01-01');
  });

  it('passes other cells through untouched', () => {
    expect(cellText('  spaced  ')).toBe('  spaced  ');
    expect(cellText(null)).toBe('');
    expect(cellText(42)).toBe('42');
  });
});

describe('spacing in an uploaded cell', () => {
  const headers = ['record_id', 'Name', 'School', 'Status', 'Notes', 'Count'];
  const gridRows = [row({ record_id: 'r1', cells: [cell(TEXT, null), cell(NUM, null)] })];

  it('keeps free text exactly as it was typed', () => {
    const sheet = prepareUpload([TEXT, NUM], gridRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: '  two  spaces  ', Count: '' },
    ]);
    expect(sheet.rows[0].values.notes).toBe('  two  spaces  ');
  });

  it('ignores stray spacing around a typed value', () => {
    const sheet = prepareUpload([TEXT, NUM], gridRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: '', Count: '  7 ' },
    ]);
    expect(sheet.rows[0].values.count).toBe(7);
  });

  it('treats a cell of only spaces as untouched', () => {
    const sheet = prepareUpload([TEXT, NUM], gridRows, headers, [
      { record_id: 'r1', Name: '', School: '', Status: '', Notes: '   ', Count: '' },
    ]);
    expect(sheet.rows[0].values).toEqual({});
    expect(sheet.rows[0].unchanged).toBe(true);
  });
});

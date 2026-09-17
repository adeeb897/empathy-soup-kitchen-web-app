import { csvCell, toCsv, isoDate } from './csv';

/**
 * These cover the parts of CSV export that are easy to get wrong and expensive
 * to get wrong: quoting values a donor typed, and stopping a spreadsheet from
 * executing them.
 */
describe('csvCell', () => {
  it('quotes ordinary text', () => {
    expect(csvCell('Dana')).toBe('"Dana"');
  });

  it('doubles embedded quotes', () => {
    expect(csvCell('He said "hello"')).toBe('"He said ""hello"""');
  });

  it('keeps a comma inside one field', () => {
    expect(csvCell('12 Main St, Apt 4')).toBe('"12 Main St, Apt 4"');
  });

  it('keeps a newline inside the quoted field', () => {
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('writes null and undefined as empty, not as the word', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it('leaves finite numbers unquoted so spreadsheets sum them', () => {
    expect(csvCell(1250.5)).toBe('1250.5');
    expect(csvCell(0)).toBe('0');
  });

  it('quotes non-finite numbers rather than emitting NaN as a bare token', () => {
    expect(csvCell(NaN)).toBe('"NaN"');
    expect(csvCell(Infinity)).toBe('"Infinity"');
  });

  // The security-relevant ones: a spreadsheet runs a cell that opens with any
  // of these, so a donor could otherwise put a formula in the notes field and
  // have it execute for whoever opens the export.
  it('neutralises a leading = so the cell is not run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")'))
      .toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
  });

  it('neutralises the other formula lead-ins', () => {
    expect(csvCell('+1+1')).toBe('"\'+1+1"');
    expect(csvCell('-2-3')).toBe('"\'-2-3"');
    expect(csvCell('@SUM(A1:A9)')).toBe('"\'@SUM(A1:A9)"');
    expect(csvCell('\tcmd')).toBe('"\'\tcmd"');
    expect(csvCell('\rcmd')).toBe('"\'\rcmd"');
  });

  it('leaves a formula character alone when it is not leading', () => {
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell('user@example.com')).toBe('"user@example.com"');
  });
});

describe('toCsv', () => {
  it('writes a header row and one line per row, CRLF separated', () => {
    const out = toCsv(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(out).toBe('﻿"A","B"\r\n"1","2"\r\n"3","4"\r\n');
  });

  it('starts with a BOM so Excel reads UTF-8 correctly', () => {
    expect(toCsv(['Name'], [['Gómez']]).charCodeAt(0)).toBe(0xfeff);
  });

  it('handles no rows', () => {
    expect(toCsv(['A'], [])).toBe('﻿"A"\r\n');
  });
});

describe('isoDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 2, 14))).toBe('2026-03-14');
  });

  it('returns empty for missing or unparseable input', () => {
    expect(isoDate(null)).toBe('');
    expect(isoDate(undefined)).toBe('');
    expect(isoDate('not a date')).toBe('');
  });
});

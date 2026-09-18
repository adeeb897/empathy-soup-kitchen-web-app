/**
 * CSV generation for admin exports.
 *
 * Two things here are not optional, because the rows contain whatever a donor
 * typed into a public form:
 *
 * 1. Quoting. Names, addresses and notes contain commas, quotes and newlines.
 *    Every field is quoted and internal quotes are doubled, per RFC 4180.
 *
 * 2. Formula injection. Excel and Google Sheets treat a cell beginning with
 *    =, +, -, @, tab or carriage return as a formula, so a donor who types
 *    `=HYPERLINK("http://evil","click")` into the notes field gets that
 *    executed in the spreadsheet of whoever opens the export. Those values are
 *    prefixed with an apostrophe, which both applications read as "this is
 *    text" and do not display as part of the value.
 */

/** Leading characters a spreadsheet will treat as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Makes one value safe to put in a cell.
 * Exported for the sake of testing; callers normally want toCsv().
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';

  // Real numbers go out bare. Excel coerces a quoted numeric back to a number,
  // but not every spreadsheet does, and a column of text is a column nobody can
  // sum — which is most of the reason to export at all.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  let text = String(value);

  // Neutralise a leading formula character before quoting, so the apostrophe
  // ends up inside the quoted field where the spreadsheet will see it.
  if (FORMULA_LEAD.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV document from a header row and data rows.
 *
 * Uses CRLF line endings (RFC 4180, and what Excel expects) and prepends a
 * UTF-8 byte order mark, without which Excel misreads accented characters in
 * names and addresses as mojibake.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/**
 * Hands the browser a file to save.
 *
 * The object URL is released on the next tick rather than immediately, because
 * revoking it synchronously can cancel the download in some browsers before it
 * has started reading the blob.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** YYYY-MM-DD in local time, for filenames and sortable date cells. */
export function isoDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

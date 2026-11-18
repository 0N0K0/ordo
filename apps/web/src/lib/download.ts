import { safeFilename } from '@ordo/shared';
/**
 * Blob of a base64 data URL.
 * @param {string} dataUrl Data URL.
 * @returns {Blob} Blob.
 */
function dataUrlBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: /^data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream' });
}

/**
 * Saves a file in the browser.
 * @param {Blob | string} content Content: a blob, or a data URL (an image…).
 * @param {string} filename File name.
 * @returns {void}
 */
export function download(content: Blob | string, filename: string): void {
  // Large data URLs are not reliably downloaded: always through a blob.
  const blob = typeof content === 'string' ? dataUrlBlob(content) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * File name of an export (characters forbidden in file names replaced).
 * @param {string} title Title.
 * @param {string} extension Extension.
 * @returns {string} File name.
 */
export const fileName = (title: string, extension: string) => `${safeFilename(title)}.${extension}`;

/**
 * Message of a failed request: the error the API gives (as JSON or text), else the one given.
 * @param {Response} response Failed response.
 * @param {string} fallback Message without one.
 * @returns {Promise<string>} Message.
 */
async function failure(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '');
  try {
    return (JSON.parse(text) as { error?: string }).error || fallback;
  } catch {
    return text || fallback;
  }
}

/**
 * Downloads a file the API serves (an archive, a statement…), under its name.
 * @param {string} url Address.
 * @param {string} filename File name.
 * @param {string} fallback Error message when the API gives none.
 * @returns {Promise<void>}
 */
export async function fetchDownload(url: string, filename: string, fallback: string): Promise<void> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(await failure(response, fallback));
  download(await response.blob(), filename);
}

/**
 * Downloads an export the API builds from what it is sent (a PDF of a table, of charts, of the calendar).
 * @param {string} path Address of the export.
 * @param {unknown} body What it is built from.
 * @param {string} filename File name.
 * @param {string} [fallback] Error message when the API gives none. Optional. Default = « Le PDF n’a pas pu être créé. ».
 * @returns {Promise<void>}
 */
export async function postExport(path: string, body: unknown, filename: string, fallback = 'Le PDF n’a pas pu être créé.'): Promise<void> {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await failure(response, fallback));
  download(await response.blob(), filename);
}

/** Row of a PDF table: a heading of a group, or a row of cells, indented by its depth. */
export interface PdfTableRow {
  kind: 'group' | 'row';
  depth: number;
  cells: string[];
}

/**
 * Downloads a table as PDF (built by the API): its title, its rows, each column aligned.
 * @param {{ title: string, subtitle?: string, columns: string[], rows: PdfTableRow[], align: ('left' | 'right')[] }} table Table.
 * @returns {Promise<void>}
 */
export function postTablePdf(table: { title: string; subtitle?: string; columns: string[]; rows: PdfTableRow[]; align: ('left' | 'right')[] }): Promise<void> {
  return postExport('/api/exports/table.pdf', table, fileName(table.title, 'pdf'));
}

/**
 * Downloads lines as CSV, for spreadsheets set in French: semicolons, decimal commas, UTF-8 with BOM, texts quoted.
 * @param {(string | number | null)[][]} lines Lines, the header first.
 * @param {string} title File title.
 * @returns {void}
 */
export function downloadCsv(lines: (string | number | null)[][], title: string): void {
  const cell = (value: string | number | null) => (value === null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : `"${value.replace(/"/g, '""')}"`);
  download(new Blob(['﻿', lines.map((line) => line.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName(title, 'csv'));
}

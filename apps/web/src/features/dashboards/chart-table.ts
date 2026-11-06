import { isTimeDimension, type ChartConfig } from '@ordo/shared';
import { DIMENSION_LABELS, MONEY_MEASURES, type ChartData } from './aggregate';
import { exportFileName, saveFile } from './chart-image';

/** Data of a chart as a table: one row per value of the axis, one column per series. */
export interface ChartTable {
  columns: string[];
  /** Raw values: the axis label, then numbers (null: none). */
  rows: (string | number | null)[][];
  /** Columns in percent (ratios). */
  percent: boolean[];
  /** Total row (sums), when they make sense. */
  total: (number | null)[] | null;
  /** Amounts in euros. */
  money: boolean;
}

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * Table of the data of a chart: the axis then each series (data sets and comparisons), or the slices of a
 * donut; a total row when sums mean something (not running totals, balances nor percents).
 * @param {ChartData} data Chart data.
 * @param {ChartConfig} config Configuration.
 * @returns {ChartTable} Table.
 */
export function chartTable(data: ChartData, config: ChartConfig): ChartTable {
  const axis = config.type === 'burndown' ? 'Jour' : isTimeDimension(config.dimension) ? 'Période' : DIMENSION_LABELS[config.dimension];
  const money = !data.mixed && MONEY_MEASURES.includes(config.measure);
  const summable = config.type !== 'burndown' && !config.cumulative && config.measure !== 'balance';
  if (config.type === 'donut') {
    const rows = data.slices.map((slice) => [slice.name, slice.value]);
    return { columns: [axis, 'Valeur'], rows, percent: [false, false], total: summable ? [null, data.slices.reduce((sum, slice) => sum + slice.value, 0)] : null, money };
  }
  const percent = [false, ...data.series.map((serie) => serie.yAxisId === 'right')];
  const rows = data.rows.map((row) => [String(row.x), ...data.series.map((serie) => (typeof row[serie.name] === 'number' ? (row[serie.name] as number) : null))]);
  const total = summable
    ? [null, ...data.series.map((_, index) => (percent[index + 1] ? null : Math.round(rows.reduce((sum, row) => sum + ((row[index + 1] as number | null) ?? 0), 0) * 100) / 100))]
    : null;
  return { columns: [axis, ...data.series.map((serie) => serie.name)], rows, percent, total, money };
}

/**
 * Downloads the data of a chart as CSV, for spreadsheets set in French: semicolons, decimal commas, UTF-8 with
 * BOM, raw numbers (no currency nor percent sign).
 * @param {ChartTable} table Table.
 * @param {string} title File title.
 * @returns {void}
 */
export function downloadChartCsv(table: ChartTable, title: string): void {
  const cell = (value: string | number | null) => (value === null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : `"${value.replace(/"/g, '""')}"`);
  // Raw numbers: the unit of the percents is in their header.
  const lines = [table.columns.map((column, index) => cell(table.percent[index] ? `${column} (%)` : column)), ...table.rows.map((row) => row.map(cell))];
  if (table.total) lines.push([cell('Total'), ...table.total.slice(1).map(cell)]);
  saveFile(new Blob(['﻿', lines.map((line) => line.join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), exportFileName(title, 'csv'));
}

/**
 * Downloads the data of a chart as a PDF table (built by the API): amounts in euros, ratios in percent.
 * @param {ChartTable} table Table.
 * @param {string} title Title.
 * @param {string} subtitle Subtitle (what the chart shows).
 * @returns {Promise<void>}
 */
export async function downloadChartTablePdf(table: ChartTable, title: string, subtitle: string): Promise<void> {
  const format = (value: string | number | null, index: number) =>
    value === null ? '' : typeof value === 'string' ? value : table.percent[index] ? `${numberFormat.format(value)} %` : (table.money ? moneyFormat : numberFormat).format(value);
  const rows = table.rows.map((row) => ({ kind: 'row' as const, depth: 0, cells: row.map(format) }));
  if (table.total) rows.push({ kind: 'row', depth: 0, cells: ['Total', ...table.total.slice(1).map((value, index) => format(value, index + 1))] });
  const response = await fetch('/api/exports/table.pdf', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, subtitle, columns: table.columns, rows, align: table.columns.map((_, index) => (index === 0 ? 'left' : 'right')) }),
  });
  if (!response.ok) throw new Error('Le PDF n’a pas pu être créé.');
  saveFile(await response.blob(), exportFileName(title, 'pdf'));
}

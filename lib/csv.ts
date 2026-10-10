export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** 生成 CSV。带 BOM，Excel 打开中文不乱码；字段含逗号、引号或换行时加引号并转义 */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => esc(c.value(row))).join(','));
  return '﻿' + lines.join('\r\n');
}

export type CsvCell = string | number | null | undefined | { value: string; text: false };

function csvField(cell: CsvCell): string {
  const value = typeof cell === 'object' && cell !== null ? cell.value : cell;
  const isText = typeof cell === 'object' && cell !== null ? cell.text : typeof value === 'string';
  let field = value == null ? '' : String(value);

  if (isText && (/^[ \t]*[=+\-@]/.test(field) || /^[\t\r\n]/.test(field))) {
    field = `'${field}`;
  }

  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function serializeCsv(rows: CsvCell[][]): string {
  return `${rows.map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}

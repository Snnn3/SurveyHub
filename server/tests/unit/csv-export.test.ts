import { serializeCsv, type CsvCell } from '../../src/utils/csv-export';

describe('serializeCsv', () => {
  it('escapes RFC 4180 delimiters and preserves Unicode and empty cells', () => {
    const rows: CsvCell[][] = [
      ['title', 'value', 'empty'],
      ['雪, “survey”', 'line 1\r\nline 2, said "yes"', ''],
    ];

    expect(serializeCsv(rows)).toBe(
      'title,value,empty\r\n"雪, “survey”","line 1\r\nline 2, said ""yes""",\r\n'
    );
  });

  it('neutralizes formula-leading text but leaves numeric and date cells unchanged', () => {
    const rows: CsvCell[][] = [
      ['formula', 'number', 'date'],
      ['  +SUM(A1:A2)', -3, { value: '2026-11-28', text: false }],
      ['\tvalue', 0, { value: '2026-12-01', text: false }],
      ['\r\n@value', 12, { value: '', text: false }],
    ];

    expect(serializeCsv(rows)).toBe(
      'formula,number,date\r\n\'  +SUM(A1:A2),-3,2026-11-28\r\n\'\tvalue,0,2026-12-01\r\n"\'\r\n@value",12,\r\n'
    );
  });

  it('neutralizes all spreadsheet formula prefixes after optional spaces and tabs', () => {
    expect(serializeCsv([['=1', '  +1', ' \t-1', '@1']])).toBe("'=1,'  +1,' \t-1,'@1\r\n");
  });

  it('does not truncate long text fields', () => {
    const longText = 'x'.repeat(10000);
    expect(serializeCsv([['text'], [longText]])).toBe(`text\r\n${longText}\r\n`);
  });

  it('emits a header-only CSV as a CRLF terminated record', () => {
    expect(serializeCsv([['survey_id', 'question_id']])).toBe('survey_id,question_id\r\n');
  });
});

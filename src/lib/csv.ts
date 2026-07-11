// RFC4180風の軽量CSVパーサー/シリアライザ(外部ライブラリ非依存)。
// クォートされたフィールド内のカンマ・改行・エスケープされた `""` に対応する。

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function needsQuote(v: string): boolean {
  return /[",\r\n]/.test(v);
}

export function toCsvField(v: string): string {
  return needsQuote(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsvRow(fields: string[]): string {
  return fields.map(toCsvField).join(",");
}

export function toCsv(rows: string[][]): string {
  return rows.map(toCsvRow).join("\r\n") + "\r\n";
}

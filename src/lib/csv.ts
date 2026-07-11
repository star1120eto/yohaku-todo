import Papa from "papaparse";

// CSVのパース/組み立ては自前実装せず、papaparse(RFC4180の引用符・埋め込みカンマ/
// 改行・エスケープ済みダブルクォートに対応)に委譲する薄いラッパー。

export function parseCsv(text: string): string[][] {
  return Papa.parse<string[]>(text, { skipEmptyLines: false }).data;
}

export function toCsv(rows: string[][]): string {
  return Papa.unparse(rows, { newline: "\r\n" });
}

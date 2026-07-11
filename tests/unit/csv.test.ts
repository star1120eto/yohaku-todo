import { describe, it, expect } from "vitest";
import { parseCsv, toCsv, toCsvField, toCsvRow } from "@/lib/csv";

describe("parseCsv", () => {
  it("単純なカンマ区切りの行を解析する", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("CRLF改行にも対応する", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("末尾に改行が無くても最後の行を読み取る", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ダブルクォートで囲まれたフィールド内のカンマ・改行を1つのフィールドとして扱う", () => {
    const input = 'a,"b, with comma","c\nwith newline"\n';
    expect(parseCsv(input)).toEqual([["a", "b, with comma", "c\nwith newline"]]);
  });

  it('二重のダブルクォート("")はエスケープされた1つのダブルクォートとして扱う', () => {
    expect(parseCsv('"say ""hi""",ok\n')).toEqual([['say "hi"', "ok"]]);
  });

  it("空行は空文字1個の行として返る", () => {
    expect(parseCsv("a,b\n\nc,d\n")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });
});

describe("toCsvField / toCsvRow / toCsv", () => {
  it("カンマ・改行・ダブルクォートを含まないフィールドはそのまま出力する", () => {
    expect(toCsvField("plain")).toBe("plain");
  });

  it("カンマを含むフィールドはダブルクォートで囲む", () => {
    expect(toCsvField("a,b")).toBe('"a,b"');
  });

  it("ダブルクォートを含むフィールドはエスケープしてダブルクォートで囲む", () => {
    expect(toCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("toCsvRowはフィールドをカンマで結合する", () => {
    expect(toCsvRow(["a", "b,c", "d"])).toBe('a,"b,c",d');
  });

  it("toCsvは各行をCRLFで結合し、末尾にもCRLFを付ける", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe("a,b\r\n1,2\r\n");
  });

  it("パースしたCSVを再度シリアライズすると内容が保持される(往復変換)", () => {
    const original = 'title,"note, with comma"\n"say ""hi""","multi\nline"\n';
    const rows = parseCsv(original);
    const roundTripped = toCsv(rows);
    expect(parseCsv(roundTripped)).toEqual(rows);
  });
});

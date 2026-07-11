import { describe, it, expect } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("単純なカンマ区切りの行を解析する", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      [""], // 末尾の改行の後の空行
    ]);
  });

  it("CRLF改行にも対応する", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
      [""],
    ]);
  });

  it("末尾に改行が無ければ余分な空行は付かない", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ダブルクォートで囲まれたフィールド内のカンマ・改行を1つのフィールドとして扱う", () => {
    const input = 'a,"b, with comma","c\nwith newline"';
    expect(parseCsv(input)).toEqual([["a", "b, with comma", "c\nwith newline"]]);
  });

  it('二重のダブルクォート("")はエスケープされた1つのダブルクォートとして扱う', () => {
    expect(parseCsv('"say ""hi""",ok')).toEqual([['say "hi"', "ok"]]);
  });

  it("空行は空文字1個の行として返る", () => {
    expect(parseCsv("a,b\n\nc,d")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });
});

describe("toCsv", () => {
  it("各行をカンマで結合し、行同士はCRLFで区切る", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["1", "2"],
      ])
    ).toBe("a,b\r\n1,2");
  });

  it("カンマ・改行・ダブルクォートを含むフィールドは引用符で囲みエスケープする", () => {
    expect(toCsv([["a,b", 'say "hi"', "line1\nline2"]])).toBe(
      '"a,b","say ""hi""","line1\nline2"'
    );
  });

  it("パースしたCSVを再度シリアライズすると内容が保持される(往復変換)", () => {
    const original = 'title,"note, with comma"\r\n"say ""hi""","multi\nline"\r\n';
    const rows = parseCsv(original);
    const roundTripped = toCsv(rows);
    expect(parseCsv(roundTripped)).toEqual(rows);
  });
});

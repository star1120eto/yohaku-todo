import { test, expect } from "@playwright/test";
import { register, uniqueSuffix } from "./helpers";

const SAMPLE_CSV = `TYPE,CONTENT,DESCRIPTION,IS_COLLAPSED,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG
meta,view_style=board,,,,,,,,,,,,,
,,,,,,,,,,,,,,
task,[Example Article](https://example.com/articles/1),,,4,1,Yuta (53193251),,,,Asia/Tokyo,,,,
,,,,,,,,,,,,,,
section,ブックマーク,,False,,,,,,,,,,,
task,[Another Link](https://example.com/articles/2),メモ書き,,4,1,Yuta (53193251),,,,Asia/Tokyo,,,,
,,,,,,,,,,,,,,
`;

test.describe("CSVインポート・エクスポート", () => {
  test("TickTick形式のCSVを取り込んでフォルダとして展開し、同じ形式でエクスポートし直せる", async ({
    page,
  }) => {
    await register(page);
    // ダウンロードファイル名の検証のため、フォルダ名はASCIIにする
    // (このサンドボックスのChromiumは filename* のマルチバイトUTF-8を正しく解釈しないため。
    // 日本語コンテンツ自体の取り込み・書き出しはCSV本文側のアサーションで検証している)
    const folderName = `Import${uniqueSuffix()}`;

    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        await dialog.accept(folderName);
      } else {
        await dialog.accept();
      }
    });

    await page.locator('input[type="file"]').setInputFiles({
      name: "sample.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(SAMPLE_CSV),
    });

    const folderNav = page.getByRole("button", { name: `📁 ${folderName}` });
    await expect(folderNav).toBeVisible();
    await folderNav.click();
    await expect(page.getByRole("heading", { name: folderName })).toBeVisible();

    // Markdownリンク形式のタスクはタイトルとURL(メモ)に分解されている
    await expect(page.getByText("Example Article")).toBeVisible();
    await expect(page.getByText("Another Link")).toBeVisible();

    // ボード表示に切り替えると、CSVのsection行がセクション(カラム)として反映されている
    await page.getByRole("button", { name: "▦ ボード" }).click();
    await expect(page.getByText("ブックマーク")).toBeVisible();
    await page.getByRole("button", { name: "☰ リスト" }).click();

    // 同じフォルダをCSVへエクスポートし直せる
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("li", { hasText: folderName }).getByTitle("CSVでエクスポート").click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${folderName}.csv`);
    const exportedPath = await download.path();
    const fs = await import("node:fs/promises");
    const exported = await fs.readFile(exportedPath!, "utf8");
    expect(exported).toContain("TYPE,CONTENT,DESCRIPTION");
    // メモがURLだけの場合はMarkdownリンクとして書き出される
    expect(exported).toContain("[Example Article](https://example.com/articles/1)");
    expect(exported).toContain("section,ブックマーク");
    // メモに説明文とURLの両方がある場合はタイトルはそのまま、メモは説明列に書き出される
    expect(exported).toContain("Another Link");
    expect(exported).toContain("メモ書き\nhttps://example.com/articles/2");
  });
});

import { test, expect } from "@playwright/test";
import { register, addTask, fillAndSubmit, uniqueSuffix } from "./helpers";

test.describe("テンプレート", () => {
  test("フォルダをテンプレートとして保存し、別フォルダとして複製できる", async ({
    page,
  }) => {
    await register(page);
    const folderName = `朝の準備${uniqueSuffix()}`;
    await page.getByTitle("フォルダを追加").click();
    await fillAndSubmit(page.getByPlaceholder("フォルダ名"), folderName);
    await page.getByRole("button", { name: `📁 ${folderName}` }).click();
    await expect(page.getByRole("heading", { name: folderName })).toBeVisible();

    await addTask(page, "歯磨き 明日 07:00 !高 #生活");
    await expect(page.getByText("歯磨き")).toBeVisible();
    await addTask(page, "着替え");
    await expect(page.getByText("着替え")).toBeVisible();

    const folders = page.getByTestId("folders");
    const folderRow = folders.locator("li", { hasText: folderName });
    const templateName = `朝ルーティン${uniqueSuffix()}`;
    page.once("dialog", (d) => d.accept(templateName));
    await folderRow.getByTitle("テンプレートとして保存").click();

    const templates = page.getByTestId("templates");
    const templateNav = templates.getByRole("button", { name: `📄 ${templateName}` });
    await expect(templateNav).toBeVisible();

    // 適用すると、フォルダ名を指定して新しいフォルダにタスクが複製される
    const newFolderName = `${templateName}(コピー)`;
    page.once("dialog", (d) => d.accept(newFolderName));
    await templateNav.click();

    const newFolderNav = folders.getByRole("button", { name: `📁 ${newFolderName}` });
    await expect(newFolderNav).toBeVisible();
    await newFolderNav.click();
    await expect(page.getByRole("heading", { name: newFolderName })).toBeVisible();
    const copiedTask = page.locator("li", { hasText: "歯磨き" });
    await expect(copiedTask).toBeVisible();
    await expect(page.getByText("着替え")).toBeVisible();
    await expect(copiedTask.getByText("生活")).toBeVisible();

    // 名前を変更できる
    const renamed = `${templateName}(改)`;
    page.once("dialog", (d) => d.accept(renamed));
    await templates.getByTitle("名前を変更").click();
    await expect(templates.getByRole("button", { name: `📄 ${renamed}` })).toBeVisible();

    // 削除できる
    page.once("dialog", (d) => d.accept());
    await templates.getByTitle("削除").click();
    await expect(templates).toBeHidden();
  });
});

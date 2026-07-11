import { test, expect } from "@playwright/test";
import {
  register,
  createSharedWorkspace,
  getInviteUrl,
  joinAsNewMember,
  uniqueSuffix,
} from "./helpers";

test.describe("ワークスペース管理(オーナー専用操作)", () => {
  test("オーナーはデフォルトロールの変更とメンバーの削除ができる", async ({
    page,
    browser,
  }) => {
    await register(page);
    const wsName = `管理テスト${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);

    const inviteUrl = await getInviteUrl(page);
    await page.keyboard.press("Escape");
    const context2 = await browser.newContext();
    const memberName = `メンバー${uniqueSuffix()}`;
    const memberPage = await joinAsNewMember(context2, inviteUrl, memberName);

    await page.reload();
    await page.getByTitle("共有").click();
    const shareDialog = page.getByRole("dialog", { name: `「${wsName}」を共有` });
    await expect(shareDialog.getByText(memberName)).toBeVisible();

    // 招待リンクから参加した人の既定ロールを「閲覧のみ」に変更する
    const defaultRoleSelect = shareDialog
      .locator("label", { hasText: "招待リンクから参加した人の権限" })
      .locator("select");
    await defaultRoleSelect.selectOption("viewer");
    await expect(defaultRoleSelect).toHaveValue("viewer");

    // メンバーを削除すると一覧から消える
    await shareDialog.locator("li", { hasText: memberName }).getByRole("button", { name: "削除" }).click();
    await expect(shareDialog.getByText(memberName)).toBeHidden();
    await page.keyboard.press("Escape");

    // 削除されたメンバー側では、そのワークスペースがワークスペース切り替え一覧から消える
    await memberPage.reload();
    await expect(memberPage.getByRole("button", { name: wsName, exact: true })).toBeHidden();

    await context2.close();
  });
});

test.describe("ロールの実効性(サーバー側の権限強制)", () => {
  test("オーナー以外がロール変更やメンバー削除を試みてもサーバー側で無視される", async ({
    page,
    browser,
  }) => {
    await register(page);
    const wsName = `強制テスト${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);
    const inviteUrl = await getInviteUrl(page);
    await page.keyboard.press("Escape");

    const contextA = await browser.newContext();
    const memberAName = `編集者A${uniqueSuffix()}`;
    const memberAPage = await joinAsNewMember(contextA, inviteUrl, memberAName);

    const contextB = await browser.newContext();
    const memberBName = `編集者B${uniqueSuffix()}`;
    const memberBPage = await joinAsNewMember(contextB, inviteUrl, memberBName);

    const listRes = await memberAPage.request.get("/api/workspaces");
    const { workspaces } = await listRes.json();
    const ws = workspaces.find((w: { name: string }) => w.name === wsName);
    const memberB = ws.members.find((m: { name: string }) => m.name === memberBName);

    // 非オーナー(編集者A)が編集者Bのロールを閲覧のみへ変更しようとしても反映されない
    const setRoleRes = await memberAPage.request.patch(`/api/workspaces/${ws.id}`, {
      data: { setRole: { userId: memberB.id, role: "viewer" } },
    });
    expect(setRoleRes.ok()).toBe(true);
    const setRoleBody = await setRoleRes.json();
    expect(setRoleBody.workspace.memberRoles?.[memberB.id]).not.toBe("viewer");

    // 非オーナー(編集者A)が編集者Bを削除しようとしても反映されない
    const removeRes = await memberAPage.request.patch(`/api/workspaces/${ws.id}`, {
      data: { removeMemberId: memberB.id },
    });
    expect(removeRes.ok()).toBe(true);
    const removeBody = await removeRes.json();
    expect(removeBody.workspace.memberIds).toContain(memberB.id);

    // 実際に編集者Bはまだ参加できている(削除されていない)
    await memberBPage.reload();
    await expect(memberBPage.getByRole("heading", { name: wsName })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test("閲覧のみ権限ではセクション作成・Webhook登録・テンプレート適用がサーバー側で拒否される", async ({
    page,
    browser,
  }) => {
    await register(page);
    const wsName = `閲覧制限テスト${uniqueSuffix()}`;
    await createSharedWorkspace(page, wsName);
    const inviteUrl = await getInviteUrl(page);

    const folderName = `共有フォルダ${uniqueSuffix()}`;
    const folderRes = await page.request.post("/api/folders", {
      data: { workspaceId: await currentWorkspaceId(page, wsName), name: folderName },
    });
    const { folder } = await folderRes.json();
    await page.keyboard.press("Escape");

    const context2 = await browser.newContext();
    const viewerName = `閲覧者${uniqueSuffix()}`;
    const viewerPage = await joinAsNewMember(context2, inviteUrl, viewerName);

    // 招待後にオーナー側でロールを閲覧のみへ変更する
    await page.reload();
    await page.getByTitle("共有").click();
    const shareDialog = page.getByRole("dialog", { name: `「${wsName}」を共有` });
    await expect(shareDialog.getByText(viewerName)).toBeVisible();
    await shareDialog
      .locator("li", { hasText: viewerName })
      .getByRole("combobox")
      .selectOption("viewer");
    await page.keyboard.press("Escape");

    const wsId = folder.workspaceId;

    // セクション作成
    const sectionRes = await viewerPage.request.post("/api/sections", {
      data: { folderId: folder.id, name: "テストセクション" },
    });
    expect(sectionRes.status()).toBe(403);
    expect((await sectionRes.json()).error).toBe("閲覧のみの権限では作成できません");

    // Webhook登録
    const webhookRes = await viewerPage.request.post("/api/webhooks", {
      data: {
        workspaceId: wsId,
        url: "https://example.com/hooks/viewer-should-fail",
        events: ["task.complete"],
      },
    });
    expect(webhookRes.status()).toBe(403);
    expect((await webhookRes.json()).error).toBe("閲覧のみの権限では作成できません");

    // テンプレート適用(閲覧者自身が所有するテンプレートでも、適用先の権限で拒否される)
    const myWsListRes = await viewerPage.request.get("/api/workspaces");
    const { workspaces: viewerWorkspaces } = await myWsListRes.json();
    const privateWs = viewerWorkspaces.find((w: { private: boolean }) => w.private);
    const ownFolderRes = await viewerPage.request.post("/api/folders", {
      data: { workspaceId: privateWs.id, name: "個人用フォルダ" },
    });
    const { folder: ownFolder } = await ownFolderRes.json();
    const templateRes = await viewerPage.request.post("/api/templates", {
      data: { name: "個人テンプレ", workspaceId: privateWs.id, folderId: ownFolder.id },
    });
    const { template } = await templateRes.json();

    const applyRes = await viewerPage.request.post(`/api/templates/${template.id}/apply`, {
      data: { workspaceId: wsId },
    });
    expect(applyRes.status()).toBe(403);
    expect((await applyRes.json()).error).toBe("閲覧のみの権限では作成できません");

    await context2.close();
  });
});

test.describe("プライベートワークスペースの削除保護", () => {
  test("プライベートワークスペースはAPIを直接呼んでも削除できない", async ({ page }) => {
    await register(page);
    const res = await page.request.get("/api/workspaces");
    const { workspaces } = await res.json();
    const privateWs = workspaces.find((w: { private: boolean }) => w.private);
    expect(privateWs).toBeTruthy();

    const deleteRes = await page.request.delete(`/api/workspaces/${privateWs.id}`);
    expect(deleteRes.status()).toBe(403);
    expect((await deleteRes.json()).error).toBe("プライベートは削除できません");
  });
});

// 現在表示中のワークスペース(名前で識別)のIDを、一覧APIから引く
async function currentWorkspaceId(page: import("@playwright/test").Page, name: string) {
  const res = await page.request.get("/api/workspaces");
  const { workspaces } = await res.json();
  const ws = workspaces.find((w: { name: string }) => w.name === name);
  return ws.id;
}

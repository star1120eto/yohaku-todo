"use client";

import { useEffect, useState } from "react";
import type { WorkspaceWithMembers } from "@/hooks/useData";
import { api } from "@/hooks/useData";
import { formatRelative } from "@/lib/format";
import { GhostButton, Modal } from "./ui";

interface ActivityEntry {
  id: string;
  actorName: string;
  detail: string;
  createdAt: string;
}

export default function ShareDialog({
  workspace,
  meId,
  onChanged,
  onClose,
}: {
  workspace: WorkspaceWithMembers;
  meId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"members" | "activity">("members");
  const [activities, setActivities] = useState<ActivityEntry[] | null>(null);
  const isOwner = workspace.ownerId === meId;

  useEffect(() => {
    if (tab === "activity" && activities === null) {
      api(`/api/activities?workspaceId=${workspace.id}&limit=50`, "GET").then((res) =>
        setActivities(res.activities)
      );
    }
  }, [tab, activities, workspace.id]);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${workspace.inviteCode}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // クリップボードが使えない環境では選択コピーしてもらう
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={`「${workspace.name}」を共有`} onClose={onClose}>
      <p className="text-xs text-ink-soft mb-2">
        このリンクを送ると、相手がこのワークスペースに参加できます。
      </p>
      <div className="flex items-center gap-2 mb-6">
        <input
          readOnly
          className="flex-1 rounded-lg border border-line bg-paper/60 px-3 py-2 text-xs text-ink-soft"
          value={inviteUrl}
          onFocus={(e) => e.target.select()}
        />
        <GhostButton onClick={copy}>{copied ? "コピー済み" : "コピー"}</GhostButton>
      </div>

      <div className="flex rounded-full border border-line p-0.5 mb-4 text-sm">
        {(["members", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              tab === t ? "bg-ink text-paper" : "text-ink-soft"
            }`}
          >
            {t === "members" ? "メンバー" : "アクティビティ"}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <>
          <ul className="divide-y divide-line/70 mb-4">
            {workspace.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs shrink-0">
                  {m.name.slice(0, 1)}
                </span>
                <span className="text-sm flex-1 truncate">
                  {m.name}
                  {m.id === meId && <span className="text-ink-faint">（自分）</span>}
                </span>
                {m.id === workspace.ownerId ? (
                  <span className="text-[11px] text-ink-faint">オーナー</span>
                ) : isOwner ? (
                  <>
                    <select
                      className="rounded-lg border border-line bg-field px-2 py-1 text-xs"
                      value={m.role}
                      onChange={async (e) => {
                        await api(`/api/workspaces/${workspace.id}`, "PATCH", {
                          setRole: { userId: m.id, role: e.target.value },
                        });
                        onChanged();
                      }}
                    >
                      <option value="editor">編集者</option>
                      <option value="viewer">閲覧のみ</option>
                    </select>
                    <button
                      className="text-xs text-danger hover:underline"
                      onClick={async () => {
                        await api(`/api/workspaces/${workspace.id}`, "PATCH", {
                          removeMemberId: m.id,
                        });
                        onChanged();
                      }}
                    >
                      削除
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-ink-faint">
                    {m.role === "viewer" ? "閲覧のみ" : "編集者"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <label className="flex items-center gap-2 text-xs text-ink-soft mb-6">
              招待リンクから参加した人の権限
              <select
                className="rounded-lg border border-line bg-field px-2 py-1 text-xs"
                value={workspace.defaultRole}
                onChange={async (e) => {
                  await api(`/api/workspaces/${workspace.id}`, "PATCH", {
                    defaultRole: e.target.value,
                  });
                  onChanged();
                }}
              >
                <option value="editor">編集者</option>
                <option value="viewer">閲覧のみ</option>
              </select>
            </label>
          )}
        </>
      ) : (
        <ul className="divide-y divide-line/70 mb-6 max-h-72 overflow-y-auto">
          {activities === null && (
            <li className="py-3 text-xs text-ink-faint">読み込み中…</li>
          )}
          {activities?.length === 0 && (
            <li className="py-3 text-xs text-ink-faint">まだ活動はありません</li>
          )}
          {activities?.map((a) => (
            <li key={a.id} className="py-2.5 text-xs text-ink-soft">
              <span className="text-ink-faint">{formatRelative(a.createdAt)}</span>{" "}
              {a.actorName} が {a.detail}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        {!isOwner && (
          <button
            className="text-sm text-danger hover:underline mr-auto"
            onClick={async () => {
              await api(`/api/workspaces/${workspace.id}`, "PATCH", {
                leave: true,
              });
              onChanged();
              onClose();
            }}
          >
            このワークスペースから退出
          </button>
        )}
        {isOwner && !workspace.private && (
          <button
            className="text-sm text-danger hover:underline mr-auto"
            onClick={async () => {
              if (!confirm(`「${workspace.name}」を削除しますか？タスクもすべて削除されます。`)) return;
              await api(`/api/workspaces/${workspace.id}`, "DELETE");
              onChanged();
              onClose();
            }}
          >
            ワークスペースを削除
          </button>
        )}
        <GhostButton onClick={onClose}>閉じる</GhostButton>
      </div>
    </Modal>
  );
}

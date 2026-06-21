"use client";

import { useState } from "react";
import type { WorkspaceWithMembers } from "@/hooks/useData";
import { api } from "@/hooks/useData";
import { GhostButton, Modal } from "./ui";

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
  const isOwner = workspace.ownerId === meId;
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

      <h3 className="text-xs text-ink-soft mb-2">メンバー</h3>
      <ul className="divide-y divide-line/70 mb-6">
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
            ) : null}
          </li>
        ))}
      </ul>

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

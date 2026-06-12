"use client";

import { useState } from "react";
import type { ParsePrefixes } from "@/lib/types";
import { api } from "@/hooks/useData";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";

export default function SettingsDialog({
  prefixes,
  userName,
  onSaved,
  onLogout,
  onClose,
}: {
  prefixes: ParsePrefixes;
  userName: string;
  onSaved: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [tag, setTag] = useState(prefixes.tag);
  const [priority, setPriority] = useState(prefixes.priority);
  const [folder, setFolder] = useState(prefixes.folder);
  const [parseDates, setParseDates] = useState(prefixes.parseDates);
  const [busy, setBusy] = useState(false);
  const [notifState, setNotifState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const requestNotification = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifState(result);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", "PUT", {
        prefixes: { tag, priority, folder, parseDates },
      });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="設定" onClose={onClose}>
      <h3 className="text-xs text-ink-soft mb-3">タイトル解析の接頭語</h3>
      <p className="text-[11px] text-ink-faint mb-4 leading-5">
        タスク入力時にこの記号で始まる単語を、それぞれの設定として読み取ります。
        例: 「{tag}買い物」→ タグ、「{priority}高」→ 優先度、「{folder}仕事」→ フォルダ
      </p>
      <div className="grid grid-cols-3 gap-4">
        <Field label="タグ">
          <input className={inputClass} value={tag} maxLength={3} onChange={(e) => setTag(e.target.value)} />
        </Field>
        <Field label="優先度">
          <input className={inputClass} value={priority} maxLength={3} onChange={(e) => setPriority(e.target.value)} />
        </Field>
        <Field label="フォルダ">
          <input className={inputClass} value={folder} maxLength={3} onChange={(e) => setFolder(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={parseDates}
          onChange={(e) => setParseDates(e.target.checked)}
          className="accent-[#5f7a6a]"
        />
        日時・繰り返しの言葉（明日、15:00、毎週 など）を読み取る
      </label>

      <h3 className="text-xs text-ink-soft mb-3">通知</h3>
      <div className="mb-6">
        {notifState === "granted" ? (
          <p className="text-sm text-accent">通知は許可されています ✓</p>
        ) : notifState === "unsupported" ? (
          <p className="text-sm text-ink-faint">このブラウザは通知に対応していません</p>
        ) : (
          <button onClick={requestNotification} className="text-sm text-accent hover:underline">
            ブラウザ通知を許可する
          </button>
        )}
        <p className="text-[11px] text-ink-faint mt-1.5 leading-5">
          期日になったタスク・指定場所に近づいたタスクを通知します。
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-line/70">
        <button onClick={onLogout} className="text-sm text-ink-faint hover:text-danger transition-colors">
          {userName} からログアウト
        </button>
        <div className="flex gap-2">
          <GhostButton onClick={onClose}>キャンセル</GhostButton>
          <PrimaryButton onClick={save} disabled={busy}>保存</PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

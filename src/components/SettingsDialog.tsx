"use client";

import { useEffect, useState } from "react";
import type { Theme, UserSettings } from "@/lib/types";
import { api } from "@/hooks/useData";
import { applyTheme } from "@/lib/theme";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";

interface GcalStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  calendarId?: string;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
  { value: "system", label: "端末に合わせる" },
];

export default function SettingsDialog({
  settings,
  userName,
  onSaved,
  onLogout,
  onClose,
}: {
  settings: UserSettings;
  userName: string;
  onSaved: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const [tag, setTag] = useState(settings.prefixes.tag);
  const [priority, setPriority] = useState(settings.prefixes.priority);
  const [folder, setFolder] = useState(settings.prefixes.folder);
  const [parseDates, setParseDates] = useState(settings.prefixes.parseDates);
  const [theme, setTheme] = useState<Theme>(settings.theme ?? "system");
  const [slackEnabled, setSlackEnabled] = useState(settings.slack?.enabled ?? false);
  const [webhookUrl, setWebhookUrl] = useState(settings.slack?.webhookUrl ?? "");
  const [slackMsg, setSlackMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [notifState, setNotifState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [gcal, setGcal] = useState<GcalStatus | null>(null);
  const [calendarId, setCalendarId] = useState("primary");
  const [gcalMsg, setGcalMsg] = useState("");

  useEffect(() => {
    api("/api/integrations/google", "GET")
      .then((res: GcalStatus) => {
        setGcal(res);
        setCalendarId(res.calendarId || "primary");
      })
      .catch(() => {});
  }, []);

  const saveCalendarId = async () => {
    setGcalMsg("");
    try {
      await api("/api/integrations/google", "PATCH", { calendarId });
      setGcalMsg("保存しました。");
    } catch (err) {
      setGcalMsg(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  const disconnectGcal = async () => {
    await api("/api/integrations/google", "DELETE");
    setGcal({ configured: true, connected: false });
  };

  const requestNotification = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifState(result);
  };

  const changeTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t); // 即時プレビュー
  };

  const persist = () =>
    api("/api/settings", "PUT", {
      prefixes: { tag, priority, folder, parseDates },
      theme,
      slack: { enabled: slackEnabled, webhookUrl },
    });

  const testSlack = async () => {
    setSlackMsg("");
    try {
      await persist(); // サーバーが保存済みWebhookを参照するため先に保存
      await api("/api/notify/slack", "POST", {
        text: "よはく のテスト通知です ✅",
      });
      setSlackMsg("送信しました。Slackをご確認ください。");
    } catch (err) {
      setSlackMsg(err instanceof Error ? err.message : "送信に失敗しました");
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await persist();
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="設定" onClose={onClose}>
      <h3 className="text-xs text-ink-soft mb-3">表示テーマ</h3>
      <div className="flex rounded-full border border-line p-0.5 mb-6 text-sm">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => changeTheme(o.value)}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              theme === o.value ? "bg-ink text-paper" : "text-ink-soft"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

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
          className="accent-accent"
        />
        日時・繰り返しの言葉（明日、15:00、毎週土曜 など）を読み取る
      </label>

      <h3 className="text-xs text-ink-soft mb-3">通知</h3>
      <div className="mb-4">
        {notifState === "granted" ? (
          <p className="text-sm text-accent">ブラウザ通知は許可されています ✓</p>
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

      <div className="rounded-xl border border-line bg-paper/60 p-4 mb-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={slackEnabled}
            onChange={(e) => setSlackEnabled(e.target.checked)}
            className="accent-accent"
          />
          Slackにも通知する
        </label>
        <input
          className={inputClass}
          placeholder="https://hooks.slack.com/services/..."
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          disabled={!slackEnabled}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-ink-faint leading-5">
            Slackの Incoming Webhook URL を貼り付けてください。
          </p>
          <button
            onClick={testSlack}
            disabled={!slackEnabled || !webhookUrl}
            className="text-xs text-accent hover:underline disabled:opacity-40 shrink-0 ml-2"
          >
            テスト送信
          </button>
        </div>
        {slackMsg && <p className="text-[11px] text-ink-soft mt-1.5">{slackMsg}</p>}
      </div>

      {gcal?.configured && (
        <div className="rounded-xl border border-line bg-paper/60 p-4 mb-6">
          <h3 className="text-xs text-ink-soft mb-2">Googleカレンダー連携</h3>
          {gcal.connected ? (
            <>
              <p className="text-sm text-accent mb-2">
                {gcal.email || "接続中"} と連携しています ✓
              </p>
              <p className="text-[11px] text-ink-faint mb-2 leading-5">
                期日のあるタスクの作成・変更・完了・削除が、このカレンダーへ反映されます。
              </p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  className={inputClass}
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="primary"
                />
                <button
                  onClick={saveCalendarId}
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  保存
                </button>
              </div>
              {gcalMsg && <p className="text-[11px] text-ink-soft mb-2">{gcalMsg}</p>}
              <button
                onClick={disconnectGcal}
                className="text-xs text-ink-faint hover:text-danger transition-colors"
              >
                連携を解除
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-ink-faint mb-3 leading-5">
                Googleカレンダーと連携すると、期日のあるタスクが自動的にカレンダーへ同期されます。
              </p>
              <a
                href="/api/integrations/google/connect"
                className="inline-block text-sm text-accent hover:underline"
              >
                Googleカレンダーと連携する
              </a>
            </>
          )}
        </div>
      )}

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

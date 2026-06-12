"use client";

import { useState } from "react";
import type { Folder, Task, TaskLocation } from "@/lib/types";
import { toLocalInputValue } from "@/lib/format";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";

export default function TaskDetail({
  task,
  folders,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  folders: Folder[];
  onSave: (patch: Partial<Task>) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [priority, setPriority] = useState(task.priority);
  const [tags, setTags] = useState(task.tags.join(", "));
  const [folderId, setFolderId] = useState(task.folderId ?? "");
  const [dueAt, setDueAt] = useState(task.dueAt ? toLocalInputValue(task.dueAt) : "");
  const [repeat, setRepeat] = useState(task.repeat ?? "");
  const [location, setLocation] = useState<TaskLocation | null>(task.location);
  const [locLabel, setLocLabel] = useState(task.location?.label ?? "");
  const [locRadius, setLocRadius] = useState(task.location?.radius ?? 300);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [busy, setBusy] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("このブラウザでは位置情報が使えません");
      return;
    }
    setGeoBusy(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          label: locLabel,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radius: locRadius,
        });
        setGeoBusy(false);
      },
      () => {
        setGeoError("現在地を取得できませんでした");
        setGeoBusy(false);
      }
    );
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        title: title.trim() || task.title,
        note,
        priority,
        tags: tags
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter(Boolean),
        folderId: folderId || null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        repeat: (repeat || null) as Task["repeat"],
        location: location
          ? { ...location, label: locLabel, radius: locRadius }
          : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="タスクの詳細" onClose={onClose}>
      <Field label="タイトル">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="メモ">
        <textarea
          className={`${inputClass} min-h-[72px] resize-y`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="補足があれば…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="期日・通知日時">
          <input
            type="datetime-local"
            className={inputClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <Field label="繰り返し">
          <select
            className={inputClass}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as typeof repeat)}
          >
            <option value="">なし</option>
            <option value="daily">毎日</option>
            <option value="weekly">毎週</option>
            <option value="monthly">毎月</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="優先度">
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as Task["priority"])}
          >
            <option value={0}>なし</option>
            <option value={1}>低</option>
            <option value={2}>中</option>
            <option value={3}>高</option>
          </select>
        </Field>
        <Field label="フォルダ">
          <select
            className={inputClass}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">なし</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="タグ（カンマ区切り）">
        <input
          className={inputClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="仕事, 買い物"
        />
      </Field>

      <div className="rounded-xl border border-line bg-paper/60 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink-soft">場所で通知</span>
          {location && (
            <button
              className="text-xs text-danger hover:underline"
              onClick={() => setLocation(null)}
            >
              解除
            </button>
          )}
        </div>
        {location ? (
          <div className="space-y-3">
            <input
              className={inputClass}
              value={locLabel}
              onChange={(e) => setLocLabel(e.target.value)}
              placeholder="場所の名前（例: スーパー）"
            />
            <div className="flex items-center gap-3 text-xs text-ink-soft">
              <span>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </span>
              <label className="flex items-center gap-1.5 ml-auto">
                半径
                <input
                  type="number"
                  min={50}
                  step={50}
                  className="w-20 rounded-lg border border-line bg-white px-2 py-1"
                  value={locRadius}
                  onChange={(e) => setLocRadius(Number(e.target.value) || 300)}
                />
                m
              </label>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={geoBusy}
            className="text-sm text-accent hover:underline disabled:opacity-50"
          >
            {geoBusy ? "取得中…" : "📍 現在地をこのタスクの場所にする"}
          </button>
        )}
        {geoError && <p className="text-xs text-danger mt-2">{geoError}</p>}
        <p className="text-[11px] text-ink-faint mt-2 leading-5">
          アプリを開いている間、登録した場所に近づくと通知します。
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={async () => {
            await onDelete();
            onClose();
          }}
          className="text-sm text-danger hover:underline"
        >
          削除
        </button>
        <div className="flex gap-2">
          <GhostButton onClick={onClose}>キャンセル</GhostButton>
          <PrimaryButton onClick={save} disabled={busy}>
            保存
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

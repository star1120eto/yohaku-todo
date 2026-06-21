"use client";

import { useState } from "react";
import type { Folder, Task, TaskLocation } from "@/lib/types";
import { WEEKDAY_JP, formatRepeat } from "@/lib/format";
import { api } from "@/hooks/useData";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";
import Calendar from "./Calendar";

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

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
  const initDue = task.dueAt ? new Date(task.dueAt) : null;
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [priority, setPriority] = useState(task.priority);
  const [tags, setTags] = useState(task.tags.join(", "));
  const [folderId, setFolderId] = useState(task.folderId ?? "");
  const [dueDate, setDueDate] = useState<Date | null>(
    initDue ? new Date(initDue.getFullYear(), initDue.getMonth(), initDue.getDate()) : null
  );
  const [dueTime, setDueTime] = useState(
    initDue ? `${pad(initDue.getHours())}:${pad(initDue.getMinutes())}` : "09:00"
  );
  const [showCal, setShowCal] = useState(false);
  const [repeat, setRepeat] = useState<string>(task.repeat ?? "");
  const [location, setLocation] = useState<TaskLocation | null>(task.location);
  const [locLabel, setLocLabel] = useState(task.location?.label ?? "");
  const [locRadius, setLocRadius] = useState(task.location?.radius ?? 300);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [addr, setAddr] = useState("");
  const [addrResults, setAddrResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const setCoords = (lat: number, lng: number, label = locLabel) =>
    setLocation({ label, lat, lng, radius: locRadius });

  const searchAddress = async () => {
    if (!addr.trim() || searching) return;
    setSearching(true);
    setGeoError("");
    setAddrResults([]);
    try {
      const { results } = (await api(
        `/api/geocode?q=${encodeURIComponent(addr.trim())}`,
        "GET"
      )) as { results: GeoResult[] };
      if (!results.length) setGeoError("該当する場所が見つかりませんでした");
      setAddrResults(results);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

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
      let dueAt: string | null = null;
      if (dueDate) {
        const [h, m] = dueTime.split(":").map(Number);
        const d = new Date(dueDate);
        d.setHours(h || 0, m || 0, 0, 0);
        dueAt = d.toISOString();
      }

      let weekday: number | null = null;
      let weekOfMonth: number | null = null;
      if (repeat === "monthly-weekday" && dueDate) {
        weekday = dueDate.getDay();
        const dom = dueDate.getDate();
        const isLast = dom + 7 > daysInMonth(dueDate);
        weekOfMonth =
          task.weekOfMonth === -1 && isLast ? -1 : Math.ceil(dom / 7);
      }

      await onSave({
        title: title.trim() || task.title,
        note,
        priority,
        tags: tags
          .split(/[,、]/)
          .map((t) => t.trim())
          .filter(Boolean),
        folderId: folderId || null,
        dueAt,
        repeat: (repeat || null) as Task["repeat"],
        weekday,
        weekOfMonth,
        location: location
          ? { ...location, label: locLabel, radius: locRadius }
          : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const dueLabel = dueDate
    ? `${dueDate.getFullYear()}/${dueDate.getMonth() + 1}/${dueDate.getDate()}(${
        WEEKDAY_JP[dueDate.getDay()]
      })`
    : "未設定";

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

      <div className="mb-4">
        <span className="block text-xs text-ink-soft mb-1.5">期日・通知日時</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCal((v) => !v)}
            className={`${inputClass} text-left flex-1`}
          >
            {dueLabel}
          </button>
          <input
            type="time"
            className={`${inputClass} w-28`}
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            disabled={!dueDate}
          />
          {dueDate && (
            <button
              type="button"
              onClick={() => {
                setDueDate(null);
                setShowCal(false);
              }}
              className="text-xs text-danger hover:underline shrink-0"
            >
              クリア
            </button>
          )}
        </div>
        {showCal && (
          <div className="mt-2 animate-fade-up">
            <Calendar
              value={dueDate}
              onSelect={(d) => {
                setDueDate(d);
                setShowCal(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="繰り返し">
          <select
            className={inputClass}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          >
            <option value="">なし</option>
            <option value="daily">毎日</option>
            <option value="weekly">毎週</option>
            <option value="monthly">毎月</option>
            {task.repeat === "monthly-weekday" && (
              <option value="monthly-weekday">{formatRepeat(task)}</option>
            )}
          </select>
        </Field>
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
      </div>

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
        <div className="space-y-3">
          <input
            className={inputClass}
            value={locLabel}
            onChange={(e) => {
              setLocLabel(e.target.value);
              if (location) setLocation({ ...location, label: e.target.value });
            }}
            placeholder="場所の名前（例: スーパー）"
          />

          {/* 住所・場所名で検索 */}
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchAddress();
                }
              }}
              placeholder="住所や場所名で検索（例: 東京駅）"
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={searching || !addr.trim()}
              className="shrink-0 rounded-lg border border-line px-3 text-sm text-ink-soft hover:text-ink disabled:opacity-40"
            >
              {searching ? "検索中…" : "検索"}
            </button>
          </div>
          {addrResults.length > 0 && (
            <ul className="rounded-lg border border-line divide-y divide-line/70 overflow-hidden">
              {addrResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setCoords(r.lat, r.lng, r.label);
                      setLocLabel(r.label);
                      setAddrResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-card/70"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 現在地・手入力 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={geoBusy}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {geoBusy ? "取得中…" : "📍 現在地を使う"}
            </button>
            {!location && (
              <button
                type="button"
                onClick={() => setCoords(35.681236, 139.767125)}
                className="text-accent hover:underline"
              >
                ✎ 緯度・経度を手入力
              </button>
            )}
          </div>

          {/* 座標(編集可) + 半径 + 地図リンク */}
          {location && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <label className="flex items-center gap-1">
                  緯度
                  <input
                    type="number"
                    step="0.000001"
                    className="w-28 rounded-lg border border-line bg-field px-2 py-1"
                    value={location.lat}
                    onChange={(e) => setCoords(Number(e.target.value), location.lng)}
                  />
                </label>
                <label className="flex items-center gap-1">
                  経度
                  <input
                    type="number"
                    step="0.000001"
                    className="w-28 rounded-lg border border-line bg-field px-2 py-1"
                    value={location.lng}
                    onChange={(e) => setCoords(location.lat, Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-soft">
                <label className="flex items-center gap-1.5">
                  半径
                  <input
                    type="number"
                    min={50}
                    step={50}
                    className="w-20 rounded-lg border border-line bg-field px-2 py-1"
                    value={locRadius}
                    onChange={(e) => {
                      const r = Number(e.target.value) || 300;
                      setLocRadius(r);
                      setLocation({ ...location, radius: r });
                    }}
                  />
                  m
                </label>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-accent hover:underline"
                >
                  地図で開く ↗
                </a>
              </div>
            </div>
          )}
        </div>
        {geoError && <p className="text-xs text-danger mt-2">{geoError}</p>}
        <p className="text-[11px] text-ink-faint mt-2 leading-5">
          現在地・住所検索・緯度経度の手入力で場所を登録できます。アプリを開いている間、近づくと通知します。
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

"use client";

import { useEffect, useState } from "react";
import type { Folder, Section, Task, TaskLocation } from "@/lib/types";
import { WEEKDAY_JP, formatRelative, formatRepeat } from "@/lib/format";
import { api } from "@/hooks/useData";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";
import Calendar from "./Calendar";
import {
  ArrowUpwardIcon,
  AttachFileIcon,
  EditIcon,
  ICON_SIZE,
  LocationIcon,
  OpenInNewIcon,
} from "./icons";

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

interface CommentEntry {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  attachments: { id: string; name: string; size: number; mime: string }[];
  createdAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

const REMINDER_OPTIONS = [
  { value: 0, label: "当日" },
  { value: 10, label: "10分前" },
  { value: 30, label: "30分前" },
  { value: 60, label: "1時間前" },
  { value: 1440, label: "1日前" },
];

export default function TaskDetail({
  task,
  folders,
  allTasks,
  members = [],
  canEdit = true,
  meId,
  onOpenTask,
  onTasksChanged,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  folders: Folder[];
  allTasks: Task[];
  members?: { id: string; name: string }[];
  canEdit?: boolean;
  meId?: string;
  onOpenTask: (task: Task) => void;
  onTasksChanged: () => void;
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
  const [sectionId, setSectionId] = useState(task.sectionId ?? "");
  const [sections, setSections] = useState<Section[]>([]);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [dueDate, setDueDate] = useState<Date | null>(
    initDue ? new Date(initDue.getFullYear(), initDue.getMonth(), initDue.getDate()) : null
  );
  const [dueTime, setDueTime] = useState(
    initDue ? `${pad(initDue.getHours())}:${pad(initDue.getMinutes())}` : "09:00"
  );
  const [durationMinutes, setDurationMinutes] = useState(task.durationMinutes ?? 0);
  const [showCal, setShowCal] = useState(false);
  const initDeadline = task.deadlineAt ? new Date(task.deadlineAt) : null;
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(
    initDeadline
      ? new Date(initDeadline.getFullYear(), initDeadline.getMonth(), initDeadline.getDate())
      : null
  );
  const [showDeadlineCal, setShowDeadlineCal] = useState(false);
  const [reminders, setReminders] = useState<number[]>(
    task.reminders?.length ? task.reminders : [0]
  );
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
  const [newSubtask, setNewSubtask] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<
    { id: string; actorName: string; detail: string; createdAt: string }[] | null
  >(null);
  const [comments, setComments] = useState<CommentEntry[] | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api(`/api/comments?taskId=${task.id}`, "GET").then((res) => {
      if (!cancelled) setComments(res.comments);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const postComment = async () => {
    if (!commentBody.trim() && commentFiles.length === 0) return;
    setPosting(true);
    setCommentError("");
    try {
      const form = new FormData();
      form.set("taskId", task.id);
      form.set("body", commentBody.trim());
      for (const f of commentFiles) form.append("files", f);
      const res = await fetch("/api/comments", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "投稿に失敗しました");
      setComments((prev) => [...(prev ?? []), data.comment]);
      setCommentBody("");
      setCommentFiles([]);
      onTasksChanged(); // コメント数バッジを更新
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: string) => {
    await api(`/api/comments/${id}`, "DELETE");
    setComments((prev) => prev?.filter((c) => c.id !== id) ?? null);
    onTasksChanged();
  };

  const parentTask = task.parentId
    ? allTasks.find((t) => t.id === task.parentId) ?? null
    : null;
  const subtasks = allTasks
    .filter((t) => t.parentId === task.id)
    .sort((a, b) => a.order - b.order);

  // フォルダに応じてセクション候補を読み込む。フォルダを変更したら選択中のセクションは解除する
  useEffect(() => {
    if (!folderId) {
      setSections([]);
      setSectionId("");
      return;
    }
    let cancelled = false;
    api(`/api/sections?folderId=${folderId}`, "GET").then((res) => {
      if (!cancelled) setSections(res.sections);
    });
    if (folderId !== task.folderId) setSectionId("");
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    await api("/api/tasks", "POST", {
      workspaceId: task.workspaceId,
      parentId: task.id,
      title: newSubtask.trim(),
    });
    setNewSubtask("");
    onTasksChanged();
  };

  const toggleSubtask = async (t: Task) => {
    await api(`/api/tasks/${t.id}`, "PATCH", { completed: !t.completed });
    onTasksChanged();
  };

  const deleteSubtask = async (t: Task) => {
    await api(`/api/tasks/${t.id}`, "DELETE");
    onTasksChanged();
  };

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

      let deadlineAt: string | null = null;
      if (deadlineDate) {
        const d = new Date(deadlineDate);
        d.setHours(23, 59, 0, 0);
        deadlineAt = d.toISOString();
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
        sectionId: sectionId || null,
        assigneeId: assigneeId || null,
        durationMinutes: durationMinutes || null,
        dueAt,
        deadlineAt,
        reminders,
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
  const deadlineLabel = deadlineDate
    ? `${deadlineDate.getFullYear()}/${deadlineDate.getMonth() + 1}/${deadlineDate.getDate()}(${
        WEEKDAY_JP[deadlineDate.getDay()]
      })`
    : "未設定";
  const toggleReminder = (v: number) =>
    setReminders((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)
    );

  return (
    <Modal title="タスクの詳細" onClose={onClose}>
      {!canEdit && (
        <p className="text-xs text-ink-faint mb-4 rounded-lg bg-paper/60 border border-line px-3 py-2">
          閲覧のみの権限です。完了状態の切り替えのみできます。
        </p>
      )}
      <fieldset disabled={!canEdit} className="contents">
      <Field label="タイトル">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      {parentTask && (
        <button
          type="button"
          onClick={() => onOpenTask(parentTask)}
          className="inline-flex items-center gap-1 mb-4 text-xs text-accent hover:underline"
        >
          <ArrowUpwardIcon size={ICON_SIZE.md} /> 親: {parentTask.title}
        </button>
      )}

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
        {dueDate && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {REMINDER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleReminder(o.value)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                  reminders.includes(o.value)
                    ? "bg-accent text-white"
                    : "bg-field border border-line text-ink-soft hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <span className="block text-xs text-ink-soft mb-1.5">締切</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeadlineCal((v) => !v)}
            className={`${inputClass} text-left flex-1`}
          >
            {deadlineLabel}
          </button>
          {deadlineDate && (
            <button
              type="button"
              onClick={() => {
                setDeadlineDate(null);
                setShowDeadlineCal(false);
              }}
              className="text-xs text-danger hover:underline shrink-0"
            >
              クリア
            </button>
          )}
        </div>
        {showDeadlineCal && (
          <div className="mt-2 animate-fade-up">
            <Calendar
              value={deadlineDate}
              onSelect={(d) => {
                setDeadlineDate(d);
                setShowDeadlineCal(false);
              }}
            />
          </div>
        )}
      </div>

      <Field label="所要時間">
        <select
          className={inputClass}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
        >
          <option value={0}>なし</option>
          <option value={15}>15分</option>
          <option value={30}>30分</option>
          <option value={45}>45分</option>
          <option value={60}>1時間</option>
          <option value={90}>1時間30分</option>
          <option value={120}>2時間</option>
          <option value={180}>3時間</option>
          <option value={240}>半日(4時間)</option>
        </select>
      </Field>

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

      <div className={members.length > 1 ? "grid grid-cols-2 gap-4" : ""}>
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
        {members.length > 1 && (
          <Field label="担当者">
            <select
              className={inputClass}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">なし</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {folderId && sections.length > 0 && (
        <Field label="セクション">
          <select
            className={inputClass}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">なし</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

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
              className="inline-flex items-center gap-1 text-accent hover:underline disabled:opacity-50"
            >
              {geoBusy ? (
                "取得中…"
              ) : (
                <>
                  <LocationIcon size={ICON_SIZE.md} /> 現在地を使う
                </>
              )}
            </button>
            {!location && (
              <button
                type="button"
                onClick={() => setCoords(35.681236, 139.767125)}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <EditIcon size={ICON_SIZE.md} /> 緯度・経度を手入力
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
                  className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"
                >
                  地図で開く <OpenInNewIcon size={ICON_SIZE.md} />
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
      </fieldset>

      {!task.parentId && (
        <div className="mb-4">
          <span className="block text-xs text-ink-soft mb-1.5">
            サブタスク{subtasks.length > 0 && ` (${subtasks.filter((s) => s.completed).length}/${subtasks.length})`}
          </span>
          {subtasks.length > 0 && (
            <ul className="mb-2 space-y-1">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 group">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(s)}
                    aria-label={s.completed ? "未完了に戻す" : "完了にする"}
                    className={`w-4 h-4 shrink-0 rounded-full border transition-all ${
                      s.completed ? "bg-accent border-accent" : "border-ink-faint hover:border-accent"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenTask(s)}
                    className={`flex-1 text-left text-sm truncate ${
                      s.completed ? "text-ink-faint line-through" : ""
                    }`}
                  >
                    {s.title}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => deleteSubtask(s)}
                      className="text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form onSubmit={addSubtask} className="flex gap-2">
              <input
                className={`${inputClass} text-sm`}
                placeholder="サブタスクを追加"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newSubtask.trim()}
                className="shrink-0 rounded-lg border border-line px-3 text-sm text-ink-soft hover:text-ink disabled:opacity-40"
              >
                追加
              </button>
            </form>
          )}
        </div>
      )}

      <div className="mb-4">
        <span className="block text-xs text-ink-soft mb-1.5">
          コメント{comments && comments.length > 0 && ` (${comments.length})`}
        </span>
        <ul className="mb-2 space-y-3">
          {comments === null && <li className="text-xs text-ink-faint">読み込み中…</li>}
          {comments?.map((c) => (
            <li key={c.id} className="group">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[11px] shrink-0">
                  {c.authorName.slice(0, 1)}
                </span>
                <span className="text-xs text-ink-soft">{c.authorName}</span>
                <span className="text-[11px] text-ink-faint">{formatRelative(c.createdAt)}</span>
                {c.authorId === meId && (
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="ml-auto text-[11px] text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    削除
                  </button>
                )}
              </div>
              {c.body && (
                <p className="text-sm text-ink pl-8 mt-0.5 whitespace-pre-wrap">{c.body}</p>
              )}
              {c.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pl-8 mt-1">
                  {c.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/files/${c.id}/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      {a.mime.startsWith("image/") ? (
                        <img
                          src={`/api/files/${c.id}/${a.id}`}
                          alt={a.name}
                          className="h-16 w-16 object-cover rounded-lg border border-line"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-accent hover:underline rounded-lg border border-line px-2 py-1">
                          <AttachFileIcon size={ICON_SIZE.md} /> {a.name}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
          {comments?.length === 0 && (
            <li className="text-xs text-ink-faint">まだコメントはありません</li>
          )}
        </ul>
        <div className="rounded-lg border border-line p-2">
          <textarea
            className="w-full bg-transparent text-sm resize-y min-h-[52px] placeholder:text-ink-faint"
            placeholder="コメントを入力（Cmd/Ctrl+Enterで送信）"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                postComment();
              }
            }}
          />
          {commentFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {commentFiles.map((f, i) => (
                <span
                  key={i}
                  className="text-[11px] text-ink-soft rounded-full bg-field border border-line px-2 py-0.5"
                >
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setCommentFiles((prev) => prev.filter((_, x) => x !== i))}
                    className="ml-1 text-ink-faint hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <label
              className="inline-flex text-ink-faint hover:text-ink cursor-pointer text-sm"
              aria-label="ファイルを添付"
            >
              <AttachFileIcon size={ICON_SIZE.xl} />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).slice(0, 3);
                  setCommentFiles(files);
                }}
              />
            </label>
            <PrimaryButton
              onClick={postComment}
              disabled={posting || (!commentBody.trim() && commentFiles.length === 0)}
            >
              送信
            </PrimaryButton>
          </div>
          {commentError && <p className="text-xs text-danger mt-1.5">{commentError}</p>}
        </div>
      </div>

      <div className="mb-4">
        <button
          type="button"
          onClick={async () => {
            const next = !showHistory;
            setShowHistory(next);
            if (next && history === null) {
              const res = await api(
                `/api/activities?workspaceId=${task.workspaceId}&taskId=${task.id}`,
                "GET"
              );
              setHistory(res.activities);
            }
          }}
          className="text-xs text-ink-faint hover:text-ink transition-colors"
        >
          {showHistory ? "▾" : "▸"} 履歴
        </button>
        {showHistory && (
          <ul className="mt-2 space-y-1.5">
            {history === null && <li className="text-xs text-ink-faint">読み込み中…</li>}
            {history?.length === 0 && <li className="text-xs text-ink-faint">履歴なし</li>}
            {history?.map((h) => (
              <li key={h.id} className="text-xs text-ink-soft">
                <span className="text-ink-faint">{formatRelative(h.createdAt)}</span>{" "}
                {h.actorName} が {h.detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        {canEdit ? (
          <button
            onClick={async () => {
              await onDelete();
              onClose();
            }}
            className="text-sm text-danger hover:underline"
          >
            削除
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <GhostButton onClick={onClose}>{canEdit ? "キャンセル" : "閉じる"}</GhostButton>
          {canEdit && (
            <PrimaryButton onClick={save} disabled={busy}>
              保存
            </PrimaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

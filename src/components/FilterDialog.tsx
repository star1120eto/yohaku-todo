"use client";

import { useState } from "react";
import type { Folder, SavedFilter } from "@/lib/types";
import { api } from "@/hooks/useData";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";

const PRIORITY_CHOICES = [
  { value: "高", label: "高" },
  { value: "中", label: "中" },
  { value: "低", label: "低" },
];

const DUE_CHOICES = [
  { value: "", label: "指定なし" },
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "overdue", label: "期限切れ" },
  { value: "none", label: "期日なし" },
];

function buildQuery(opts: {
  priorities: string[];
  due: string;
  tags: string;
  folder: string;
}): string {
  const parts: string[] = [];
  if (opts.priorities.length) parts.push(`priority:${opts.priorities.join(",")}`);
  if (opts.due) parts.push(`due:${opts.due}`);
  const tagList = opts.tags
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tagList.length) parts.push(`tag:${tagList.join(",")}`);
  if (opts.folder.trim()) parts.push(`folder:${opts.folder.trim()}`);
  return parts.join(" ");
}

function parseInitialQuery(query: string) {
  const priorities: string[] = [];
  let due = "";
  let tags = "";
  let folder = "";
  for (const token of query.split(/\s+/)) {
    const m = token.match(/^(priority|due|tag|folder):(.+)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === "priority") priorities.push(...m[2].split(","));
    else if (key === "due") due = m[2];
    else if (key === "tag") tags = m[2].split(",").join(", ");
    else if (key === "folder") folder = m[2];
  }
  return { priorities, due, tags, folder };
}

export default function FilterDialog({
  existing,
  folders,
  onSaved,
  onClose,
}: {
  existing: SavedFilter | null;
  folders: Folder[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const initial = existing ? parseInitialQuery(existing.query) : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [priorities, setPriorities] = useState<string[]>(initial?.priorities ?? []);
  const [due, setDue] = useState(initial?.due ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [folder, setFolder] = useState(initial?.folder ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const togglePriority = (v: string) =>
    setPriorities((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const query = buildQuery({ priorities, due, tags, folder });

  const save = async () => {
    if (!name.trim() || !query) return;
    setBusy(true);
    setError("");
    try {
      if (existing) {
        await api(`/api/filters/${existing.id}`, "PATCH", { name: name.trim(), query });
      } else {
        await api("/api/filters", "POST", { name: name.trim(), query });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={existing ? "フィルターを編集" : "フィルターを作成"} onClose={onClose}>
      <Field label="名前">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 今日の高優先度"
        />
      </Field>

      <div className="mb-4">
        <span className="block text-xs text-ink-soft mb-1.5">優先度</span>
        <div className="flex gap-1.5">
          {PRIORITY_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => togglePriority(c.value)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                priorities.includes(c.value)
                  ? "bg-accent text-white"
                  : "bg-field border border-line text-ink-soft hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="期日">
        <select className={inputClass} value={due} onChange={(e) => setDue(e.target.value)}>
          {DUE_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="タグ（カンマ区切り、いずれかに一致）">
        <input
          className={inputClass}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="仕事, 買い物"
        />
      </Field>

      <Field label="フォルダ">
        <select className={inputClass} value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="">指定なし</option>
          {folders.map((f) => (
            <option key={f.id} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-[11px] text-ink-faint mb-4">
        クエリ: {query || "(条件を選んでください)"}
      </p>

      {error && <p className="text-xs text-danger mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <GhostButton onClick={onClose}>キャンセル</GhostButton>
        <PrimaryButton onClick={save} disabled={!name.trim() || !query || busy}>
          保存
        </PrimaryButton>
      </div>
    </Modal>
  );
}

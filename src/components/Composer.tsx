"use client";

import { useMemo, useState } from "react";
import { parseTitle } from "@/lib/parse";
import { DEFAULT_PREFIXES, PRIORITY_LABELS, type ParsePrefixes } from "@/lib/types";
import { formatDue, formatDuration, formatRepeat } from "@/lib/format";
import { PriorityDot, Tag } from "./ui";
import { AddIcon, ArrowForwardIcon, FolderIcon, ICON_SIZE, IconText, ScheduleIcon } from "./icons";

export default function Composer({
  prefixes,
  onSubmit,
}: {
  prefixes: ParsePrefixes | undefined;
  onSubmit: (raw: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const p = prefixes ?? DEFAULT_PREFIXES;

  const parsed = useMemo(
    () => (value.trim() ? parseTitle(value, p) : null),
    [value, p]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-8">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 shadow-soft focus-within:border-accent/50 transition-colors">
        <AddIcon size={ICON_SIZE.xl} className="text-ink-faint shrink-0" />
        <input
          className="flex-1 bg-transparent text-sm placeholder:text-ink-faint"
          placeholder={`タスクを追加（例: 企画書を出す 明日 15:00 ${p.tag}仕事 ${p.priority}高 ${p.folder}案件A）`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {parsed &&
        (parsed.dueAt ||
          parsed.priority > 0 ||
          parsed.tags.length > 0 ||
          parsed.folderName ||
          parsed.repeat ||
          parsed.durationMinutes) && (
          <div
            className="flex flex-wrap items-center gap-2 px-2 pt-2.5 text-xs text-ink-soft animate-fade-up"
            data-testid="composer-preview"
          >
            <span className="text-ink-faint">
              <ArrowForwardIcon size={ICON_SIZE.md} />
            </span>
            <span className="text-ink">{parsed.title || "(タイトルなし)"}</span>
            {parsed.dueAt && (
              <span className="rounded-full bg-field border border-line px-2 py-0.5">
                {formatDue(parsed.dueAt.toISOString())}
              </span>
            )}
            {parsed.repeat && (
              <span className="rounded-full bg-field border border-line px-2 py-0.5">
                {formatRepeat({
                  repeat: parsed.repeat,
                  dueAt: parsed.dueAt,
                  weekday: parsed.weekday,
                  weekOfMonth: parsed.weekOfMonth,
                })}
              </span>
            )}
            {parsed.priority > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-field border border-line px-2 py-0.5">
                <PriorityDot priority={parsed.priority} />
                {PRIORITY_LABELS[parsed.priority]}
              </span>
            )}
            {parsed.tags.map((t) => (
              <Tag key={t} name={t} />
            ))}
            {parsed.folderName && (
              <IconText
                icon={FolderIcon}
                size={ICON_SIZE.md}
                className="rounded-full bg-field border border-line px-2 py-0.5"
              >
                {parsed.folderName}
              </IconText>
            )}
            {parsed.durationMinutes && (
              <IconText
                icon={ScheduleIcon}
                size={ICON_SIZE.md}
                className="rounded-full bg-field border border-line px-2 py-0.5"
              >
                {formatDuration(parsed.durationMinutes)}
              </IconText>
            )}
          </div>
        )}
    </form>
  );
}

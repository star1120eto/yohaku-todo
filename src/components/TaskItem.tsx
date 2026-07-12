"use client";

import type { Task } from "@/lib/types";
import {
  deadlineColor,
  formatDeadline,
  formatDue,
  formatDuration,
  formatRepeat,
  isOverdue,
} from "@/lib/format";
import { PriorityDot, Tag } from "./ui";
import { ChatBubbleIcon, FlagIcon, LocationIcon, RepeatIcon, ScheduleIcon } from "./icons";

export default function TaskItem({
  task,
  onToggle,
  onOpen,
  depth = 0,
  childCount = 0,
  completedChildCount = 0,
  assigneeName,
  commentCount = 0,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  depth?: 0 | 1;
  childCount?: number;
  completedChildCount?: number;
  assigneeName?: string;
  commentCount?: number;
}) {
  const overdue = !task.completed && task.dueAt && isOverdue(task.dueAt);

  return (
    <li
      className={`group flex items-start gap-3 px-2 py-3 border-b border-line/70 last:border-b-0 hover:bg-card/70 rounded-lg transition-colors ${
        depth > 0 ? "pl-8" : ""
      }`}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={task.completed ? "未完了に戻す" : "完了にする"}
        className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full border transition-all ${
          task.completed
            ? "bg-accent border-accent"
            : "border-ink-faint hover:border-accent"
        }`}
      >
        {task.completed && (
          <svg viewBox="0 0 18 18" fill="none" className="text-white">
            <path d="M5 9.5l2.5 2.5L13 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <button
        onClick={() => onOpen(task)}
        className="flex-1 min-w-0 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <PriorityDot priority={task.priority} />
          <span
            className={`text-sm truncate ${
              task.completed ? "text-ink-faint line-through" : ""
            }`}
          >
            {task.title}
          </span>
          {childCount > 0 && (
            <span className="text-[11px] text-ink-faint shrink-0">
              {completedChildCount}/{childCount}
            </span>
          )}
          {assigneeName && (
            <span
              title={assigneeName}
              className="w-5 h-5 shrink-0 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[10px] ml-auto"
            >
              {assigneeName.slice(0, 1)}
            </span>
          )}
        </div>
        {(task.dueAt ||
          task.deadlineAt ||
          task.tags.length > 0 ||
          task.repeat ||
          task.location ||
          task.durationMinutes ||
          commentCount > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-ink-faint">
            {task.dueAt && (
              <span className={overdue ? "text-danger" : ""}>
                {formatDue(task.dueAt)}
              </span>
            )}
            {task.deadlineAt && !task.completed && (
              <span className={`inline-flex items-center gap-0.5 ${deadlineColor(task.deadlineAt)}`}>
                <FlagIcon size={11} /> {formatDeadline(task.deadlineAt)}
              </span>
            )}
            {task.durationMinutes && (
              <span className="inline-flex items-center gap-0.5">
                <ScheduleIcon size={11} /> {formatDuration(task.durationMinutes)}
              </span>
            )}
            {task.repeat && (
              <span className="inline-flex items-center gap-0.5">
                <RepeatIcon size={11} /> {formatRepeat(task)}
              </span>
            )}
            {task.location && (
              <span className="inline-flex items-center gap-0.5">
                <LocationIcon size={11} /> {task.location.label || "指定場所"}
              </span>
            )}
            {task.tags.map((t) => (
              <Tag key={t} name={t} />
            ))}
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <ChatBubbleIcon size={11} /> {commentCount}
              </span>
            )}
          </div>
        )}
      </button>
    </li>
  );
}

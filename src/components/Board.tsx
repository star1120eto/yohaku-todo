"use client";

import { useState } from "react";
import type { Section, Task } from "@/lib/types";
import type { TaskNode } from "@/lib/tree";
import { formatDue, formatDuration, isOverdue } from "@/lib/format";
import { PriorityDot, Tag } from "./ui";

export interface BoardGroup {
  section: Section | null;
  nodes: TaskNode[];
}

function BoardCard({
  task,
  assigneeName,
  onOpen,
}: {
  task: Task;
  assigneeName?: string;
  onOpen: (t: Task) => void;
}) {
  const overdue = !task.completed && task.dueAt && isOverdue(task.dueAt);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
      }}
      onClick={() => onOpen(task)}
      className="cursor-pointer rounded-lg border border-line bg-card p-3 mb-2 shadow-soft hover:border-accent/40 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <PriorityDot priority={task.priority} />
        <span
          className={`text-sm truncate ${task.completed ? "text-ink-faint line-through" : ""}`}
        >
          {task.title}
        </span>
        {assigneeName && (
          <span
            title={assigneeName}
            className="w-4 h-4 shrink-0 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[9px] ml-auto"
          >
            {assigneeName.slice(0, 1)}
          </span>
        )}
      </div>
      {(task.dueAt || task.durationMinutes || task.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1.5 text-[11px] text-ink-faint">
          {task.dueAt && (
            <span className={overdue ? "text-danger" : ""}>{formatDue(task.dueAt)}</span>
          )}
          {task.durationMinutes && <span>⏱ {formatDuration(task.durationMinutes)}</span>}
          {task.tags.slice(0, 2).map((t) => (
            <Tag key={t} name={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardColumn({
  title,
  sectionId,
  nodes,
  memberNameById,
  onOpen,
  onMoveTask,
  onAddTask,
  onRename,
  onDelete,
}: {
  title: string;
  sectionId: string | null;
  nodes: TaskNode[];
  memberNameById: Map<string, string>;
  onOpen: (t: Task) => void;
  onMoveTask: (taskId: string, sectionId: string | null) => void;
  onAddTask: (sectionId: string | null, title: string) => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const topLevel = nodes.filter((n) => n.depth === 0);

  return (
    <div
      className={`shrink-0 w-64 rounded-xl p-2 transition-colors ${
        dragOver ? "bg-accent-soft" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const taskId = e.dataTransfer.getData("text/task-id");
        if (taskId) onMoveTask(taskId, sectionId);
      }}
    >
      <div className="group flex items-center gap-1.5 px-1 mb-2">
        <span
          onDoubleClick={() => {
            if (!onRename) return;
            const next = prompt("セクション名を変更", title);
            if (next && next.trim()) onRename(next.trim());
          }}
          className={`text-[11px] text-ink-faint flex-1 truncate ${onRename ? "cursor-text" : ""}`}
          title={onRename ? "ダブルクリックで名前を変更" : undefined}
        >
          {title}
        </span>
        <span className="text-[10px] text-ink-faint">{topLevel.length}</span>
        <button
          onClick={() => setAdding(true)}
          className="text-ink-faint hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        >
          ＋
        </button>
        {onDelete && (
          <button
            onClick={() => {
              if (confirm(`セクション「${title}」を削除しますか？（中のタスクは残ります）`)) {
                onDelete();
              }
            }}
            className="text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity text-xs"
          >
            ×
          </button>
        )}
      </div>
      <div className="max-h-[calc(100dvh-260px)] overflow-y-auto px-0.5">
        {topLevel.map((n) => (
          <BoardCard
            key={n.task.id}
            task={n.task}
            assigneeName={n.task.assigneeId ? memberNameById.get(n.task.assigneeId) : undefined}
            onOpen={onOpen}
          />
        ))}
      </div>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newTitle.trim()) onAddTask(sectionId, newTitle.trim());
            setNewTitle("");
            setAdding(false);
          }}
        >
          <input
            autoFocus
            className="w-full bg-transparent text-sm border-b border-line px-1 py-1"
            placeholder="タスクを追加"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => {
              if (!newTitle.trim()) setAdding(false);
            }}
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full text-left text-xs text-ink-faint hover:text-ink px-1 py-1"
        >
          ＋ タスク
        </button>
      )}
    </div>
  );
}

export default function Board({
  groups,
  memberNameById,
  onOpen,
  onMoveTask,
  onAddTask,
  onRenameSection,
  onDeleteSection,
}: {
  groups: BoardGroup[];
  memberNameById: Map<string, string>;
  onOpen: (t: Task) => void;
  onMoveTask: (taskId: string, sectionId: string | null) => void;
  onAddTask: (sectionId: string | null, title: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 snap-x">
      {groups.map((g) => (
        <div key={g.section?.id ?? "none"} className="snap-start">
          <BoardColumn
            title={g.section?.name ?? "セクションなし"}
            sectionId={g.section?.id ?? null}
            nodes={g.nodes}
            memberNameById={memberNameById}
            onOpen={onOpen}
            onMoveTask={onMoveTask}
            onAddTask={onAddTask}
            onRename={g.section ? (name) => onRenameSection(g.section!.id, name) : undefined}
            onDelete={g.section ? () => onDeleteSection(g.section!.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

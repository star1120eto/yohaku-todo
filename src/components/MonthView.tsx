"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { monthCells, sameDay } from "@/lib/calendar";
import { WEEKDAY_JP, weekdayColor } from "@/lib/format";
import { PriorityDot } from "./ui";

export default function MonthView({
  tasks,
  onToggle,
  onOpen,
  onAddTask,
}: {
  tasks: Task[]; // 期日のあるタスク(現在のフィルターに従う)
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onAddTask: (date: Date, title: string) => void;
}) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const year = view.getFullYear();
  const month = view.getMonth();
  const cells = monthCells(year, month);
  const today = new Date();

  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const tasksByDay = new Map<string, Task[]>();
  const noDateCount = tasks.filter((t) => !t.dueAt).length;
  for (const t of tasks) {
    if (!t.dueAt) continue;
    const key = keyOf(new Date(t.dueAt));
    if (!tasksByDay.has(key)) tasksByDay.set(key, []);
    tasksByDay.get(key)!.push(t);
  }
  for (const list of tasksByDay.values()) {
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime();
    });
  }

  const selectedTasks = selected ? tasksByDay.get(keyOf(selected)) ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="p-1 text-ink-soft hover:text-ink rounded-md"
          aria-label="前の月"
        >
          ‹
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {year}年 {month + 1}月
          </span>
          <button
            onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-[11px] text-accent hover:underline"
          >
            今日
          </button>
        </div>
        <button
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="p-1 text-ink-soft hover:text-ink rounded-md"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] mb-1">
        {WEEKDAY_JP.map((w, i) => (
          <div key={w} className={`py-1 ${weekdayColor(i) || "text-ink-faint"}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const dayTasks = tasksByDay.get(keyOf(date)) ?? [];
          const isToday = sameDay(date, today);
          const isSelected = selected && sameDay(date, selected);
          return (
            <button
              key={i}
              onClick={() => setSelected(date)}
              aria-label={`${date.getMonth() + 1}月${date.getDate()}日`}
              className={`min-h-[64px] rounded-lg border p-1 text-left align-top transition-colors ${
                isSelected ? "border-accent bg-accent-soft" : "border-line/70 hover:bg-card/70"
              }`}
            >
              <span
                className={`text-xs ${weekdayColor(date.getDay())} ${
                  isToday ? "inline-flex w-5 h-5 items-center justify-center rounded-full ring-1 ring-accent/50" : ""
                }`}
              >
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-1 text-[10px] truncate">
                    <PriorityDot priority={t.priority} />
                    <span className={t.completed ? "text-ink-faint line-through" : "text-ink-soft"}>
                      {t.title}
                    </span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-ink-faint">+{dayTasks.length - 3}件</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {noDateCount > 0 && (
        <p className="text-[11px] text-ink-faint mt-3 px-1">期日なし {noDateCount}件</p>
      )}

      {selected && (
        <div className="mt-6 animate-fade-up">
          <h3 className="text-sm mb-2">
            {selected.getMonth() + 1}/{selected.getDate()}({WEEKDAY_JP[selected.getDay()]})
          </h3>
          {selectedTasks.length === 0 && (
            <p className="text-xs text-ink-faint mb-2">タスクなし</p>
          )}
          <ul className="mb-2">
            {selectedTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 px-1 py-1.5 border-b border-line/70 last:border-b-0"
              >
                <button
                  onClick={() => onToggle(t)}
                  className={`w-4 h-4 shrink-0 rounded-full border ${
                    t.completed ? "bg-accent border-accent" : "border-ink-faint hover:border-accent"
                  }`}
                />
                <button
                  onClick={() => onOpen(t)}
                  className={`flex-1 text-left text-sm truncate ${
                    t.completed ? "text-ink-faint line-through" : ""
                  }`}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim() && selected) onAddTask(selected, newTitle.trim());
              setNewTitle("");
            }}
          >
            <input
              className="flex-1 bg-transparent text-sm border-b border-line px-1 py-1"
              placeholder="この日にタスクを追加"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </form>
        </div>
      )}
    </div>
  );
}

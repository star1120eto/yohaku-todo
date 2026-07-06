"use client";

import { useState } from "react";
import { WEEKDAY_JP, weekdayColor } from "@/lib/format";
import { monthCells, sameDay } from "@/lib/calendar";

export default function Calendar({
  value,
  onSelect,
}: {
  value: Date | null;
  onSelect: (d: Date) => void;
}) {
  const [view, setView] = useState(() => {
    const base = value ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const cells = monthCells(year, month);
  const today = new Date();

  const shift = (delta: number) =>
    setView(new Date(year, month + delta, 1));

  return (
    <div className="rounded-xl border border-line bg-field p-3 select-none">
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="p-1 text-ink-soft hover:text-ink rounded-md"
          aria-label="前の月"
        >
          ‹
        </button>
        <span className="text-sm">
          {year}年 {month + 1}月
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
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

      <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
        {cells.map((date, i) => {
          if (date === null) return <div key={i} />;
          const dow = date.getDay();
          const selected = value && sameDay(date, value);
          const isToday = sameDay(date, today);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(date)}
              className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                selected
                  ? "bg-accent text-white"
                  : `hover:bg-accent-soft ${weekdayColor(dow)}`
              } ${isToday && !selected ? "ring-1 ring-accent/40" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

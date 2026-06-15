"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/20 backdrop-blur-[2px] p-0 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card shadow-pop animate-fade-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <h2 className="text-base font-medium tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-2 p-2 text-ink-faint hover:text-ink transition-colors"
            aria-label="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs text-ink-soft mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm focus:border-accent/60 transition-colors placeholder:text-ink-faint";

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-full bg-ink text-paper px-5 py-2 text-sm hover:bg-ink/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft hover:text-ink hover:border-ink-faint transition-colors"
    >
      {children}
    </button>
  );
}

const PRIORITY_DOT: Record<number, string> = {
  3: "bg-danger",
  2: "bg-[#c79a4e]",
  1: "bg-[#7d9d87]",
};

export function PriorityDot({ priority }: { priority: number }) {
  if (!priority) return null;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[priority]}`}
    />
  );
}

export function Tag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft text-accent px-2 py-0.5 text-[11px] leading-4">
      {name}
    </span>
  );
}

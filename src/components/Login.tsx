"use client";

import { useState } from "react";
import { api } from "@/hooks/useData";
import { inputClass, PrimaryButton } from "./ui";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth", "POST", { name: name.trim() });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center animate-fade-up">
        <h1 className="font-serif text-[2.75rem] leading-none tracking-tight mb-4">
          Yohaku<span className="text-ink-faint font-normal"> ToDo</span>
        </h1>
        <p className="text-sm text-ink-soft mb-10 leading-7">
          余白を大切にする、静かな ToDo。
          <br />
          名前を入れてはじめましょう。
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            className={`${inputClass} text-center py-2.5`}
            placeholder="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <PrimaryButton type="submit" disabled={!name.trim() || busy}>
            はじめる
          </PrimaryButton>
        </form>
      </div>
    </main>
  );
}

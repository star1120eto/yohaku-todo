"use client";

import { useState } from "react";
import { api } from "@/hooks/useData";
import { inputClass, PrimaryButton } from "./ui";

type Mode = "register" | "login";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = email.trim() && password && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await api("/api/auth/register", "POST", {
          name: name.trim(),
          email: email.trim(),
          password,
        });
      } else {
        await api("/api/auth/login", "POST", {
          email: email.trim(),
          password,
        });
      }
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center">
          <h1 className="font-serif text-[2.75rem] leading-none tracking-tight mb-4">
            Yohaku<span className="text-ink-faint font-normal"> ToDo</span>
          </h1>
          <p className="text-sm text-ink-soft mb-8 leading-7">
            余白を大切にする、静かな ToDo。
          </p>
        </div>

        <div className="flex rounded-full border border-line p-0.5 mb-6 text-sm">
          {(["register", "login"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`flex-1 rounded-full py-1.5 transition-colors ${
                mode === m ? "bg-ink text-paper" : "text-ink-soft"
              }`}
            >
              {m === "register" ? "新規登録" : "ログイン"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              className={inputClass}
              placeholder="名前（任意）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className={inputClass}
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <input
            className={inputClass}
            type="password"
            placeholder={mode === "register" ? "パスワード（6文字以上）" : "パスワード"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
          {error && <p className="text-xs text-danger pt-1">{error}</p>}
          <div className="pt-2 flex justify-center">
            <PrimaryButton type="submit" disabled={!canSubmit}>
              {mode === "register" ? "アカウントを作成" : "ログイン"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </main>
  );
}

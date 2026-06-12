"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, useMe } from "@/hooks/useData";
import Login from "@/components/Login";

// 招待リンクの着地ページ。ログイン済みならそのまま参加し、
// 未ログインなら先に名前を登録してから参加する。
export default function JoinPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const { user, isLoading, mutate } = useMe();
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (isLoading || !user || joining) return;
    setJoining(true);
    api("/api/join", "POST", { code: params.code })
      .then((res) => {
        localStorage.setItem("yohaku:workspace", res.workspace.id);
        router.replace("/");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "参加できませんでした");
      });
  }, [isLoading, user, joining, params.code, router]);

  if (isLoading) return null;
  if (!user) return <Login onLogin={() => mutate()} />;

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-danger mb-4">{error}</p>
            <button
              onClick={() => router.replace("/")}
              className="text-sm text-accent hover:underline"
            >
              ホームへ戻る
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-faint">ワークスペースに参加しています…</p>
        )}
      </div>
    </main>
  );
}

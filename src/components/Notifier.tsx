"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/lib/types";
import { distanceMeters } from "@/lib/format";

// 期日通知・繰り返し通知・位置情報通知をブラウザ上で担う。
// 通知済みの記録は localStorage に持ち、(タスクID, 期日) の組ごとに 1 回だけ通知する。
// 繰り返しタスクは完了時にサーバー側で期日が次回へ進むため、組が変わって再び通知される。

function notify(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png" });
  } catch {
    // 一部モバイルブラウザはページからの直接通知に未対応
  }
}

function sendSlack(text: string) {
  // サーバーが保存済みWebhookへ送る。失敗は通知体験を妨げないよう握りつぶす。
  fetch("/api/notify/slack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export default function Notifier({
  tasks,
  slackEnabled,
}: {
  tasks: Task[];
  slackEnabled: boolean;
}) {
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const slackRef = useRef(slackEnabled);
  slackRef.current = slackEnabled;

  // 期日になったタスクの通知 (20秒間隔でチェック)
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const t of tasksRef.current) {
        if (t.completed || !t.dueAt) continue;
        const due = new Date(t.dueAt).getTime();
        if (due > now) continue;
        // 通知が古くなりすぎたもの(1日以上前)は起動時に鳴らさない
        if (now - due > 86400000) continue;
        const key = `yohaku:notified:${t.id}:${t.dueAt}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
        notify("よはく", `「${t.title}」の時間です`);
        if (slackRef.current) sendSlack(`⏰ 「${t.title}」の時間です`);
      }
    };
    check();
    const timer = setInterval(check, 20000);
    return () => clearInterval(timer);
  }, []);

  // 指定場所に近づいたときの通知
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const hasGeoTasks = tasks.some((t) => !t.completed && t.location);
    if (!hasGeoTasks) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        for (const t of tasksRef.current) {
          if (t.completed || !t.location) continue;
          const d = distanceMeters(
            latitude,
            longitude,
            t.location.lat,
            t.location.lng
          );
          const key = `yohaku:geo:${t.id}`;
          if (d <= t.location.radius) {
            if (!localStorage.getItem(key)) {
              localStorage.setItem(key, "1");
              const msg = `「${t.location.label || "指定の場所"}」の近くです: ${t.title}`;
              notify("よはく", msg);
              if (slackRef.current) sendSlack(`📍 ${msg}`);
            }
          } else if (d > t.location.radius * 1.5) {
            // 十分離れたらリセットし、次に近づいたとき再通知できるようにする
            localStorage.removeItem(key);
          }
        }
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tasks]);

  return null;
}

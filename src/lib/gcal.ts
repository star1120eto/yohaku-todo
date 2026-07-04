import { readDb, updateDb } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";
import type { GoogleAccount, Task } from "./types";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "";
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

// 3つの環境変数が揃っていない限り、連携機能そのものを無効化する
export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("token exchange failed");
  return res.json();
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.email ?? "";
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("token refresh failed");
  const data: TokenResponse = await res.json();
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

async function validAccessToken(account: GoogleAccount): Promise<string | null> {
  if (account.expiresAt > Date.now() + 60_000) {
    return decryptSecret(account.accessToken);
  }
  try {
    const refreshToken = await decryptSecret(account.refreshToken);
    const { accessToken, expiresAt } = await refreshAccessToken(refreshToken);
    const encAccessToken = await encryptSecret(accessToken);
    await updateDb((db) => {
      const acc = db.googleAccounts.find((a) => a.userId === account.userId);
      if (acc) {
        acc.accessToken = encAccessToken;
        acc.expiresAt = expiresAt;
      }
    });
    return accessToken;
  } catch {
    return null;
  }
}

function eventBody(task: Task) {
  const start = task.dueAt ? new Date(task.dueAt) : null;
  const end = start
    ? new Date(start.getTime() + (task.durationMinutes ?? 30) * 60000)
    : null;
  return {
    summary: task.title,
    description: task.note || undefined,
    start: start ? { dateTime: start.toISOString() } : undefined,
    end: end ? { dateTime: end.toISOString() } : undefined,
    extendedProperties: { private: { yohakuTaskId: task.id } },
  };
}

// タスクの期日・完了状態の変更を、接続済みならGoogleカレンダーへ反映する。
// 失敗しても呼び出し元(タスクAPI)の処理は止めない、ベストエフォートの同期。
export async function syncTaskToGoogle(userId: string, task: Task, deleted = false) {
  if (!isConfigured()) return;
  const db = await readDb();
  const account = db.googleAccounts.find((a) => a.userId === userId);
  if (!account) return;
  const link = db.gcalEventLinks.find((l) => l.userId === userId && l.taskId === task.id);

  const accessToken = await validAccessToken(account);
  if (!accessToken) return;

  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.calendarId)}/events`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    if (deleted || task.completed || !task.dueAt) {
      if (link) {
        await fetch(`${base}/${link.eventId}`, { method: "DELETE", headers }).catch(() => {});
        await updateDb((d) => {
          d.gcalEventLinks = d.gcalEventLinks.filter(
            (l) => !(l.userId === userId && l.taskId === task.id)
          );
        });
      }
      return;
    }

    if (link) {
      const res = await fetch(`${base}/${link.eventId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(eventBody(task)),
      });
      if (res.status === 404) {
        // カレンダー側で手動削除されていた場合は作り直す
        const created = await fetch(base, {
          method: "POST",
          headers,
          body: JSON.stringify(eventBody(task)),
        });
        if (created.ok) {
          const data = await created.json();
          await updateDb((d) => {
            const l = d.gcalEventLinks.find(
              (x) => x.userId === userId && x.taskId === task.id
            );
            if (l) l.eventId = data.id;
          });
        }
      }
    } else {
      const created = await fetch(base, {
        method: "POST",
        headers,
        body: JSON.stringify(eventBody(task)),
      });
      if (created.ok) {
        const data = await created.json();
        await updateDb((d) => {
          d.gcalEventLinks.push({ userId, taskId: task.id, eventId: data.id });
        });
      }
    }
  } catch {
    // ネットワークエラー等は無視する(次回の変更時に再同期される)
  }
}

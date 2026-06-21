import { currentUser, jsonError } from "@/lib/auth";

// 住所・場所名から座標を取得する(OpenStreetMap Nominatim)。
// サーバー経由にすることで CORS と User-Agent の制約を回避する。
// デプロイ環境のネットワークポリシーで外部アクセスが不可な場合は失敗を返す。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("ログインが必要です", 401);

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return jsonError("住所・場所名を入力してください", 400);

  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ja&q=" +
    encodeURIComponent(q);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "yohaku-todo/1.0 (location search)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    const results = data.map((d) => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
    return Response.json({ results });
  } catch {
    return jsonError(
      "住所から座標を取得できませんでした。地図アプリ等で調べた緯度・経度を入力してください。",
      502
    );
  }
}

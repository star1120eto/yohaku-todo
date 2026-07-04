export type Priority = 0 | 1 | 2 | 3; // 0: なし, 1: 低, 2: 中, 3: 高

// monthly-weekday: 毎月第N◯曜(例: 毎月第一金曜)
export type Repeat =
  | "daily"
  | "weekly"
  | "monthly"
  | "monthly-weekday"
  | null;

export interface User {
  id: string;
  name: string;
  email: string | null;
  passwordHash: string | null; // "salt:hash"(メール登録ユーザーのみ)
  createdAt: string;
}

export type MemberRole = "editor" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  memberRoles: Record<string, MemberRole>; // 未登録メンバーは "editor" 扱い
  defaultRole: MemberRole; // 招待リンクから参加した人の初期ロール
  inviteCode: string;
  private: boolean; // true なら共有不可の個人スペース
  createdAt: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  order: number;
  createdAt: string;
}

export interface Section {
  id: string;
  workspaceId: string;
  folderId: string; // セクションは必ずフォルダに属する
  name: string;
  order: number;
  createdAt: string;
}

export interface TaskLocation {
  label: string;
  lat: number;
  lng: number;
  radius: number; // meters
}

export interface Task {
  id: string;
  workspaceId: string;
  folderId: string | null;
  sectionId: string | null; // フォルダ内のグルーピング。folderId が null なら常に null
  parentId: string | null; // 親タスクID。1階層のみ(親自身は parentId を持てない)
  title: string;
  note: string;
  completed: boolean;
  completedAt: string | null;
  priority: Priority;
  tags: string[];
  dueAt: string | null; // ISO datetime for due / notification
  deadlineAt: string | null; // 締切(日付のみの意味。23:59保存)
  reminders: number[]; // dueAtの何分前に通知するか。[0]=期日ちょうど
  repeat: Repeat;
  weekday: number | null; // 0=日〜6=土。monthly-weekday で使用
  weekOfMonth: number | null; // 1〜5、-1=最終。monthly-weekday で使用
  location: TaskLocation | null;
  assigneeId: string | null; // 共有ワークスペースのメンバーへの単一アサイン
  durationMinutes: number | null; // 所要時間(分)。5〜1440
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface CompletionRecord {
  userId: string;
  workspaceId: string;
  taskId: string;
  completedAt: string; // ISO
}

export type ActivityType =
  | "task.create"
  | "task.complete"
  | "task.reopen"
  | "task.update"
  | "task.delete"
  | "task.comment"
  | "folder.create"
  | "folder.delete"
  | "member.join"
  | "member.leave"
  | "member.remove";

export interface Activity {
  id: string;
  workspaceId: string;
  taskId: string | null;
  actorId: string;
  type: ActivityType;
  detail: string; // 表示用に組み立て済みの日本語要約
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  path: string; // data/uploads 配下の相対パス
}

export interface Comment {
  id: string;
  taskId: string;
  workspaceId: string;
  authorId: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface TemplateItem {
  title: string;
  note: string;
  priority: Priority;
  tags: string[];
  relDays: number | null; // 生成日からの相対日数(期日なしは null)
  time: string | null; // "HH:mm"(relDays があるときのみ有効)
  repeat: Repeat;
  weekday: number | null;
  weekOfMonth: number | null;
  parentIndex: number | null; // items 配列内の親の添字(サブタスク対応)
}

export interface Template {
  id: string;
  ownerId: string;
  name: string;
  items: TemplateItem[];
  createdAt: string;
}

export interface GoogleAccount {
  userId: string;
  email: string;
  accessToken: string; // 暗号化して保存(AES-256-GCM)
  refreshToken: string; // 暗号化して保存(AES-256-GCM)
  expiresAt: number; // アクセストークンの有効期限(epoch ms)
  calendarId: string; // 同期先カレンダー。既定 "primary"
  connectedAt: string;
}

// タスク1件・接続ユーザー1人ごとの、Googleカレンダー予定IDとの対応
export interface GcalEventLink {
  userId: string;
  taskId: string;
  eventId: string;
}

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string; // sha256(平文トークンは発行時のみ返す)
  tokenPreview: string; // 一覧表示用の先頭数文字("yhk_ab12...")
  createdAt: string;
  lastUsedAt: string | null;
}

export type WebhookEvent =
  | "task.create"
  | "task.update"
  | "task.complete"
  | "task.delete";

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  "task.create",
  "task.update",
  "task.complete",
  "task.delete",
];

export interface Webhook {
  id: string;
  userId: string; // 作成者(このユーザーがアクセスできるワークスペースのみ登録可)
  workspaceId: string;
  url: string;
  secret: string; // HMAC署名用(サーバー内のみで利用、レスポンスには含めない)
  events: WebhookEvent[];
  createdAt: string;
  lastStatus: number | null;
  lastTriggeredAt: string | null;
}

export interface SavedFilter {
  id: string;
  userId: string; // フィルターは個人所有(ワークスペース非依存)
  name: string;
  query: string; // 例: "priority:高 tag:仕事 due:today"
  order: number;
  createdAt: string;
}

export interface ParsePrefixes {
  tag: string; // 例: "#"
  priority: string; // 例: "!"
  folder: string; // 例: "@"
  parseDates: boolean;
}

export type Theme = "light" | "dark" | "system";

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
}

export interface FavoriteItem {
  type: "folder" | "tag" | "filter";
  // folder: "<workspaceId>:<folderId>" / tag: タグ名そのもの / filter: savedFilterId
  ref: string;
  order: number;
}

export interface UserSettings {
  userId: string;
  prefixes: ParsePrefixes;
  theme: Theme;
  slack: SlackConfig;
  favorites: FavoriteItem[];
  inboundToken: string; // メール取り込み用の個人トークン("" は未発行)
}

export const DEFAULT_PREFIXES: ParsePrefixes = {
  tag: "#",
  priority: "!",
  folder: "@",
  parseDates: true,
};

export function defaultSettings(userId: string): UserSettings {
  return {
    userId,
    prefixes: { ...DEFAULT_PREFIXES },
    theme: "system",
    slack: { enabled: false, webhookUrl: "" },
    favorites: [],
    inboundToken: "",
  };
}

export function favoriteKey(type: FavoriteItem["type"], ref: string): string {
  return `${type}:${ref}`;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "なし",
  1: "低",
  2: "中",
  3: "高",
};

export interface Database {
  users: User[];
  workspaces: Workspace[];
  folders: Folder[];
  sections: Section[];
  tasks: Task[];
  settings: UserSettings[];
  savedFilters: SavedFilter[];
  completions: CompletionRecord[];
  activities: Activity[];
  comments: Comment[];
  templates: Template[];
  googleAccounts: GoogleAccount[];
  gcalEventLinks: GcalEventLink[];
  apiTokens: ApiToken[];
  webhooks: Webhook[];
}

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

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
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
  title: string;
  note: string;
  completed: boolean;
  completedAt: string | null;
  priority: Priority;
  tags: string[];
  dueAt: string | null; // ISO datetime for due / notification
  repeat: Repeat;
  weekday: number | null; // 0=日〜6=土。monthly-weekday で使用
  weekOfMonth: number | null; // 1〜5、-1=最終。monthly-weekday で使用
  location: TaskLocation | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface ParsePrefixes {
  tag: string; // 例: "#"
  priority: string; // 例: "!"
  folder: string; // 例: "@"
  parseDates: boolean;
}

export interface UserSettings {
  userId: string;
  prefixes: ParsePrefixes;
}

export const DEFAULT_PREFIXES: ParsePrefixes = {
  tag: "#",
  priority: "!",
  folder: "@",
  parseDates: true,
};

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
  tasks: Task[];
  settings: UserSettings[];
}

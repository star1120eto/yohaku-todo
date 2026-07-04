"use client";

import { useState } from "react";
import type { Folder, SavedFilter } from "@/lib/types";
import type { ResolvedFavorite, WorkspaceWithMembers } from "@/hooks/useData";

export type Filter =
  | { type: "all" }
  | { type: "today" }
  | { type: "mine" }
  | { type: "folder"; folderId: string }
  | { type: "tag"; tag: string }
  | { type: "search"; q: string }
  | { type: "saved"; filterId: string };

function StarButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={active ? "お気に入りから外す" : "お気に入りに登録"}
      className={`px-1.5 transition-opacity ${
        active
          ? "text-[#c79a4e] opacity-100"
          : "text-ink-faint opacity-0 group-hover:opacity-100 hover:text-[#c79a4e]"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function NavButton({
  active,
  onClick,
  children,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-center rounded-lg transition-colors ${
        active ? "bg-card shadow-soft" : "hover:bg-card/60"
      }`}
    >
      <button
        onClick={onClick}
        className={`flex-1 text-left px-3 py-1.5 text-sm truncate ${
          active ? "text-ink" : "text-ink-soft"
        }`}
      >
        {children}
      </button>
      {trailing}
    </div>
  );
}

export default function Sidebar({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onJoinWorkspace,
  onShare,
  folders,
  tags,
  filter,
  onFilter,
  onCreateFolder,
  onDeleteFolder,
  onOpenSettings,
  onOpenStats,
  taskCounts,
  savedFilters,
  onCreateFilter,
  onEditFilter,
  onDeleteFilter,
  favorites,
  isFavorite,
  onToggleFavorite,
  onSelectFavorite,
}: {
  workspaces: WorkspaceWithMembers[];
  currentWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onJoinWorkspace: () => void;
  onShare: () => void;
  folders: Folder[];
  tags: string[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  taskCounts: { all: number; today: number; mine: number };
  savedFilters: SavedFilter[];
  onCreateFilter: () => void;
  onEditFilter: (f: SavedFilter) => void;
  onDeleteFilter: (id: string) => void;
  favorites: ResolvedFavorite[];
  isFavorite: (type: "folder" | "tag" | "filter", ref: string) => boolean;
  onToggleFavorite: (type: "folder" | "tag" | "filter", ref: string) => void;
  onSelectFavorite: (f: ResolvedFavorite) => void;
}) {
  const [newFolder, setNewFolder] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const current = workspaces.find((w) => w.id === currentWorkspaceId);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-1 pb-4">
        <h1 className="font-serif text-2xl tracking-tight px-3 pb-5">
          Yohaku<span className="text-ink-faint font-normal text-lg"> ToDo</span>
        </h1>

        {favorites.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] text-ink-faint px-3 pb-1.5">お気に入り</div>
            <ul className="space-y-0.5">
              {favorites.map((f) => {
                const active =
                  (f.type === "folder" &&
                    filter.type === "folder" &&
                    filter.folderId === f.ref.split(":")[1] &&
                    currentWorkspaceId === f.workspaceId) ||
                  (f.type === "tag" && filter.type === "tag" && filter.tag === f.ref) ||
                  (f.type === "filter" && filter.type === "saved" && filter.filterId === f.ref);
                return (
                  <li key={`${f.type}:${f.ref}`}>
                    <NavButton active={active} onClick={() => onSelectFavorite(f)}>
                      {f.type === "folder" ? "📁" : f.type === "filter" ? "🔎" : "#"}{" "}
                      {f.label}
                    </NavButton>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="text-[11px] text-ink-faint px-3 pb-1.5 flex items-center justify-between">
          <span>ワークスペース</span>
          <span className="flex gap-2">
            <button onClick={onCreateWorkspace} className="hover:text-ink" title="新規作成">＋</button>
            <button onClick={onJoinWorkspace} className="hover:text-ink" title="招待コードで参加">参加</button>
          </span>
        </div>
        <ul className="space-y-0.5">
          {workspaces.map((w) => (
            <li key={w.id}>
              <NavButton
                active={w.id === currentWorkspaceId}
                onClick={() => onSelectWorkspace(w.id)}
                trailing={
                  w.id === currentWorkspaceId && !w.private ? (
                    <button
                      onClick={onShare}
                      title="共有"
                      className="px-2 text-ink-faint hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M5.8 7.1l4.4-2.2M5.8 8.9l4.4 2.2" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                    </button>
                  ) : undefined
                }
              >
                {w.name}
                {w.private && (
                  <span className="ml-1.5 text-[10px] text-ink-faint">🔒</span>
                )}
                {!w.private && w.members.length > 1 && (
                  <span className="ml-1.5 text-[10px] text-ink-faint">
                    {w.members.length}人
                  </span>
                )}
              </NavButton>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-3 pb-4">
        <div className="text-[11px] text-ink-faint px-3 pb-1.5">リスト</div>
        <ul className="space-y-0.5">
          <li>
            <NavButton active={filter.type === "all"} onClick={() => onFilter({ type: "all" })}>
              すべて
              <span className="ml-1.5 text-[10px] text-ink-faint">{taskCounts.all}</span>
            </NavButton>
          </li>
          <li>
            <NavButton active={filter.type === "today"} onClick={() => onFilter({ type: "today" })}>
              今日
              <span className="ml-1.5 text-[10px] text-ink-faint">{taskCounts.today}</span>
            </NavButton>
          </li>
          {current && !current.private && current.members.length > 1 && (
            <li>
              <NavButton active={filter.type === "mine"} onClick={() => onFilter({ type: "mine" })}>
                自分の担当
                <span className="ml-1.5 text-[10px] text-ink-faint">{taskCounts.mine}</span>
              </NavButton>
            </li>
          )}
        </ul>
      </div>

      <div className="px-3 pb-4">
        <div className="text-[11px] text-ink-faint px-3 pb-1.5 flex items-center justify-between">
          <span>フォルダ</span>
          <button onClick={() => setAddingFolder(true)} className="hover:text-ink" title="フォルダを追加">＋</button>
        </div>
        <ul className="space-y-0.5">
          {folders.map((f) => (
            <li key={f.id}>
              <NavButton
                active={filter.type === "folder" && filter.folderId === f.id}
                onClick={() => onFilter({ type: "folder", folderId: f.id })}
                trailing={
                  <span className="flex">
                    <StarButton
                      active={isFavorite("folder", `${currentWorkspaceId}:${f.id}`)}
                      onClick={() => onToggleFavorite("folder", `${currentWorkspaceId}:${f.id}`)}
                    />
                    <button
                      onClick={() => {
                        if (confirm(`フォルダ「${f.name}」を削除しますか？（中のタスクは残ります）`)) {
                          onDeleteFolder(f.id);
                        }
                      }}
                      className="px-2 text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      ×
                    </button>
                  </span>
                }
              >
                📁 {f.name}
              </NavButton>
            </li>
          ))}
          {addingFolder && (
            <li className="px-1 pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFolder.trim()) onCreateFolder(newFolder.trim());
                  setNewFolder("");
                  setAddingFolder(false);
                }}
              >
                <input
                  autoFocus
                  className="w-full rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm"
                  placeholder="フォルダ名"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  onBlur={() => setAddingFolder(false)}
                />
              </form>
            </li>
          )}
        </ul>
      </div>

      <div className="px-3 pb-4">
        <div className="text-[11px] text-ink-faint px-3 pb-1.5 flex items-center justify-between">
          <span>フィルター</span>
          <button onClick={onCreateFilter} className="hover:text-ink" title="フィルターを作成">＋</button>
        </div>
        <ul className="space-y-0.5">
          {savedFilters.map((f) => (
            <li key={f.id}>
              <NavButton
                active={filter.type === "saved" && filter.filterId === f.id}
                onClick={() => onFilter({ type: "saved", filterId: f.id })}
                trailing={
                  <span className="flex">
                    <StarButton
                      active={isFavorite("filter", f.id)}
                      onClick={() => onToggleFavorite("filter", f.id)}
                    />
                    <button
                      onClick={() => onEditFilter(f)}
                      className="px-1.5 text-ink-faint hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                      title="編集"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`フィルター「${f.name}」を削除しますか？`)) {
                          onDeleteFilter(f.id);
                        }
                      }}
                      className="px-1.5 text-ink-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      title="削除"
                    >
                      ×
                    </button>
                  </span>
                }
              >
                🔎 {f.name}
              </NavButton>
            </li>
          ))}
        </ul>
      </div>

      {tags.length > 0 && (
        <div className="px-3 pb-4">
          <div className="text-[11px] text-ink-faint px-3 pb-1.5">タグ</div>
          <div className="flex flex-wrap gap-1.5 px-3">
            {tags.map((t) => {
              const active = filter.type === "tag" && filter.tag === t;
              const fav = isFavorite("tag", t);
              return (
                <span key={t} className="group inline-flex items-center gap-0.5">
                  <button
                    onClick={() => onFilter(active ? { type: "all" } : { type: "tag", tag: t })}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                      active
                        ? "bg-accent text-white"
                        : "bg-accent-soft text-accent hover:bg-accent/20"
                    }`}
                  >
                    {t}
                  </button>
                  <button
                    onClick={() => onToggleFavorite("tag", t)}
                    title={fav ? "お気に入りから外す" : "お気に入りに登録"}
                    className={`text-[11px] transition-opacity ${
                      fav
                        ? "text-[#c79a4e] opacity-100"
                        : "text-ink-faint opacity-0 group-hover:opacity-100 hover:text-[#c79a4e]"
                    }`}
                  >
                    {fav ? "★" : "☆"}
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto px-3 pb-4">
        <button
          onClick={onOpenStats}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-faint hover:text-ink transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="9" width="2.5" height="4.5" rx="0.5" fill="currentColor" />
            <rect x="6.75" y="5" width="2.5" height="8.5" rx="0.5" fill="currentColor" />
            <rect x="11" y="7" width="2.5" height="6.5" rx="0.5" fill="currentColor" />
          </svg>
          ふりかえり
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-ink-faint hover:text-ink transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          設定
        </button>
        {current && (
          <p className="px-3 pt-1 text-[10px] text-ink-faint truncate">
            {current.name} / {current.members.length}人
          </p>
        )}
      </div>
    </div>
  );
}

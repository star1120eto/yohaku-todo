"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SavedFilter, Task } from "@/lib/types";
import { DEFAULT_PREFIXES } from "@/lib/types";
import { parseTitle } from "@/lib/parse";
import { matchesQuery } from "@/lib/format";
import { buildTaskTree } from "@/lib/tree";
import { parseQuery, matchTask } from "@/lib/filterQuery";
import {
  api,
  useFolders,
  useMe,
  useSavedFilters,
  useSettings,
  useTasks,
  useWorkspaces,
} from "@/hooks/useData";
import Login from "./Login";
import Sidebar, { type Filter } from "./Sidebar";
import Composer from "./Composer";
import TaskItem from "./TaskItem";
import TaskDetail from "./TaskDetail";
import ShareDialog from "./ShareDialog";
import SettingsDialog from "./SettingsDialog";
import FilterDialog from "./FilterDialog";
import Notifier from "./Notifier";
import { applyTheme } from "@/lib/theme";
import { Field, Modal, PrimaryButton, inputClass } from "./ui";

const WS_KEY = "yohaku:workspace";
const SIDEBAR_KEY = "yohaku:sidebar";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function App() {
  const { user, isLoading, mutate: mutateMe } = useMe();
  const { workspaces, mutate: mutateWs } = useWorkspaces(!!user);
  const [wsId, setWsId] = useState<string | null>(null);
  const { folders, mutate: mutateFolders } = useFolders(wsId);
  const { tasks, mutate: mutateTasks } = useTasks(wsId);
  const { settings, mutate: mutateSettings } = useSettings(!!user);
  const { filters: savedFilters, mutate: mutateFilters } = useSavedFilters(!!user);

  const [filter, setFilter] = useState<Filter>({ type: "all" });
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filterDialog, setFilterDialog] = useState<
    { mode: "create" } | { mode: "edit"; filter: SavedFilter } | null
  >(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsDialog, setWsDialog] = useState<"create" | "join" | null>(null);

  // タスク検索
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [crossWorkspace, setCrossWorkspace] = useState(false);
  const [crossResults, setCrossResults] = useState<
    (Task & { workspaceName: string })[]
  >([]);
  const [crossLoading, setCrossLoading] = useState(false);
  const [pendingOpenTaskId, setPendingOpenTaskId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterBeforeSearch = useRef<Filter>({ type: "all" });

  const openSearch = () => {
    if (!searchOpen) filterBeforeSearch.current = filter;
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchInput("");
    setCrossResults([]);
    setCrossWorkspace(false);
    setFilter(filterBeforeSearch.current);
  };

  // "/" キーで検索を開く(入力欄フォーカス中は無効)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "/") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Escape" && searchOpen) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (searchOpen) setFilter({ type: "search", q: searchInput });
  }, [searchInput, searchOpen]);

  // 全ワークスペース横断検索(デバウンス)
  useEffect(() => {
    if (!searchOpen || !crossWorkspace || !searchInput.trim()) {
      setCrossResults([]);
      return;
    }
    setCrossLoading(true);
    const timer = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(searchInput.trim())}`, "GET")
        .then((res) => setCrossResults(res.results))
        .finally(() => setCrossLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, crossWorkspace, searchOpen]);

  // 検索結果(別ワークスペース)からタスクを開く: WS切替後にタスクが読み込まれたら開く
  useEffect(() => {
    if (!pendingOpenTaskId) return;
    const t = tasks.find((x) => x.id === pendingOpenTaskId);
    if (t) {
      setOpenTask(t);
      setPendingOpenTaskId(null);
    }
  }, [pendingOpenTaskId, tasks]);

  // サイドバーの初期状態: デスクトップは開く(保存値を優先)、モバイルは閉じる
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved !== null) setSidebarOpen(saved === "1");
    else setSidebarOpen(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

  const toggleSidebar = () =>
    setSidebarOpen((v) => {
      localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1");
      return !v;
    });

  // モバイルではナビ操作後にサイドバーを閉じる(デスクトップは開いたまま)
  const closeOnMobile = () => {
    if (!window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen(false);
  };

  // テーマを設定に従って適用
  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  // ワークスペース選択の初期化・復元
  useEffect(() => {
    if (workspaces.length === 0) return;
    if (wsId && workspaces.some((w) => w.id === wsId)) return;
    const saved = localStorage.getItem(WS_KEY);
    const target = workspaces.find((w) => w.id === saved) ?? workspaces[0];
    setWsId(target.id);
  }, [workspaces, wsId]);

  useEffect(() => {
    if (wsId) localStorage.setItem(WS_KEY, wsId);
    setFilter({ type: "all" });
  }, [wsId]);

  const prefixes = settings?.prefixes ?? DEFAULT_PREFIXES;
  const currentWs = workspaces.find((w) => w.id === wsId) ?? null;
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    currentWs?.members.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [currentWs]);

  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.tags))].sort(),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filter.type === "today") {
      const start = startOfToday().getTime();
      const end = endOfToday().getTime();
      list = list.filter((t) => {
        const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
        const deadline = t.deadlineAt ? new Date(t.deadlineAt).getTime() : null;
        const dueMatch = due !== null && due <= end && (t.completed ? due >= start : true);
        const deadlineMatch =
          deadline !== null && deadline >= start && deadline <= end;
        return dueMatch || deadlineMatch;
      });
    } else if (filter.type === "folder") {
      list = list.filter((t) => t.folderId === filter.folderId);
    } else if (filter.type === "tag") {
      list = list.filter((t) => t.tags.includes(filter.tag));
    } else if (filter.type === "search") {
      list = list.filter((t) => matchesQuery([t.title, t.note, ...t.tags], filter.q));
    } else if (filter.type === "mine") {
      list = list.filter((t) => t.assigneeId === user?.id);
    } else if (filter.type === "saved") {
      const sf = savedFilters.find((f) => f.id === filter.filterId);
      if (sf) {
        const pq = parseQuery(sf.query);
        list = list.filter((t) => matchTask(t, pq, folders));
      }
    }
    return list;
  }, [tasks, filter, user?.id, savedFilters, folders]);

  const { active, completed } = useMemo(() => {
    const sortKey = (t: Task) => [
      t.dueAt ? 0 : 1,
      t.dueAt ? new Date(t.dueAt).getTime() : 0,
      -t.priority,
      t.order,
    ];
    const cmp = (a: Task, b: Task) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
      }
      return 0;
    };
    return {
      active: visibleTasks.filter((t) => !t.completed).sort(cmp),
      completed: visibleTasks
        .filter((t) => t.completed)
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? 0).getTime() -
            new Date(a.completedAt ?? 0).getTime()
        ),
    };
  }, [visibleTasks]);

  const activeNodes = useMemo(() => buildTaskTree(active), [active]);
  const completedNodes = useMemo(() => buildTaskTree(completed), [completed]);

  const taskCounts = useMemo(() => {
    const end = endOfToday().getTime();
    return {
      all: tasks.filter((t) => !t.completed).length,
      today: tasks.filter(
        (t) =>
          !t.completed &&
          ((t.dueAt && new Date(t.dueAt).getTime() <= end) ||
            (t.deadlineAt && new Date(t.deadlineAt).getTime() <= end))
      ).length,
      mine: tasks.filter((t) => !t.completed && t.assigneeId === user?.id).length,
    };
  }, [tasks, user?.id]);

  if (isLoading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <span className="font-serif text-lg tracking-[0.14em] text-ink-faint">よはく</span>
      </main>
    );
  }
  if (!user) {
    return (
      <Login
        onLogin={() => {
          mutateMe();
          mutateWs();
        }}
      />
    );
  }

  const addTask = async (raw: string) => {
    if (!wsId) return;
    const parsed = parseTitle(raw, prefixes);
    let folderId: string | null =
      filter.type === "folder" ? filter.folderId : null;
    if (parsed.folderName) {
      const res = await api("/api/folders", "POST", {
        workspaceId: wsId,
        name: parsed.folderName,
      });
      folderId = res.folder.id;
      mutateFolders();
    }
    const tags = [...parsed.tags];
    if (filter.type === "tag" && !tags.includes(filter.tag)) {
      tags.push(filter.tag);
    }
    await api("/api/tasks", "POST", {
      workspaceId: wsId,
      title: parsed.title || raw.trim(),
      folderId,
      priority: parsed.priority,
      tags,
      dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
      repeat: parsed.repeat,
      weekday: parsed.weekday,
      weekOfMonth: parsed.weekOfMonth,
      durationMinutes: parsed.durationMinutes,
    });
    mutateTasks();
  };

  const toggleTask = async (task: Task) => {
    if (!task.completed) {
      const hasIncompleteChildren = tasks.some(
        (t) => t.parentId === task.id && !t.completed
      );
      if (
        hasIncompleteChildren &&
        !confirm("未完了のサブタスクが残っていますが、完了にしますか？")
      ) {
        return;
      }
    }
    await api(`/api/tasks/${task.id}`, "PATCH", { completed: !task.completed });
    mutateTasks();
  };

  const filterTitle =
    filter.type === "today"
      ? "今日"
      : filter.type === "mine"
        ? "自分の担当"
        : filter.type === "folder"
          ? folders.find((f) => f.id === filter.folderId)?.name ?? "フォルダ"
          : filter.type === "tag"
            ? `タグ: ${filter.tag}`
            : filter.type === "search"
              ? "検索"
              : filter.type === "saved"
                ? savedFilters.find((f) => f.id === filter.filterId)?.name ?? "フィルター"
                : currentWs?.name ?? "すべて";

  return (
    <div className="min-h-dvh">
      <Notifier tasks={tasks} slackEnabled={settings?.slack?.enabled ?? false} />

      {/* メニューを開くボタン(閉じているとき・全サイズ共通) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          aria-label="メニューを開く"
          className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-card/90 border border-line shadow-soft text-ink-soft hover:text-ink backdrop-blur"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* サイドバー(画面の左端に固定。開閉可能) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-paper border-r border-line overflow-y-auto pt-6 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0 shadow-pop lg:shadow-none" : "-translate-x-full"
        }`}
      >
        <button
          onClick={toggleSidebar}
          aria-label="メニューを閉じる"
          className="absolute top-4 right-3 p-1 text-ink-faint hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Sidebar
          workspaces={workspaces}
          currentWorkspaceId={wsId}
          onSelectWorkspace={(id) => {
            setWsId(id);
            closeOnMobile();
          }}
          onCreateWorkspace={() => setWsDialog("create")}
          onJoinWorkspace={() => setWsDialog("join")}
          onShare={() => setShowShare(true)}
          folders={folders}
          tags={allTags}
          filter={filter}
          onFilter={(f) => {
            if (searchOpen) {
              setSearchOpen(false);
              setSearchInput("");
              setCrossResults([]);
              setCrossWorkspace(false);
            }
            setFilter(f);
            closeOnMobile();
          }}
          onCreateFolder={async (name) => {
            await api("/api/folders", "POST", { workspaceId: wsId, name });
            mutateFolders();
          }}
          onDeleteFolder={async (id) => {
            await api(`/api/folders/${id}`, "DELETE");
            mutateFolders();
            mutateTasks();
            if (filter.type === "folder" && filter.folderId === id) {
              setFilter({ type: "all" });
            }
          }}
          onOpenSettings={() => setShowSettings(true)}
          taskCounts={taskCounts}
          savedFilters={savedFilters}
          onCreateFilter={() => setFilterDialog({ mode: "create" })}
          onEditFilter={(f) => setFilterDialog({ mode: "edit", filter: f })}
          onDeleteFilter={async (id) => {
            await api(`/api/filters/${id}`, "DELETE");
            mutateFilters();
            if (filter.type === "saved" && filter.filterId === id) {
              setFilter({ type: "all" });
            }
          }}
        />
      </aside>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* メイン */}
      <main
        className={`min-w-0 px-5 sm:px-10 pt-16 lg:pt-10 pb-24 transition-[padding] duration-200 ${
          sidebarOpen ? "lg:pl-72" : "lg:pl-0"
        }`}
      >
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-normal tracking-tight flex-1">
                {filterTitle}
              </h2>
              {!searchOpen && (
                <button
                  onClick={openSearch}
                  aria-label="検索"
                  className="p-1.5 text-ink-faint hover:text-ink transition-colors"
                >
                  <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {searchOpen && (
              <div className="mb-6 animate-fade-up">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 shadow-soft focus-within:border-accent/50">
                  <svg width="15" height="15" viewBox="0 0 17 17" fill="none" className="text-ink-faint shrink-0">
                    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    className="flex-1 bg-transparent text-sm placeholder:text-ink-faint"
                    placeholder="タイトル・メモ・タグで検索"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button
                    onClick={closeSearch}
                    aria-label="検索を閉じる"
                    className="text-ink-faint hover:text-ink shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <label className="flex items-center gap-1.5 mt-2 px-1 text-xs text-ink-soft cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crossWorkspace}
                    onChange={(e) => setCrossWorkspace(e.target.checked)}
                    className="accent-accent"
                  />
                  すべてのワークスペースを検索
                </label>
              </div>
            )}

            {!searchOpen && <Composer prefixes={prefixes} onSubmit={addTask} />}

            {searchOpen && crossWorkspace ? (
              <SearchResults
                loading={crossLoading}
                results={crossResults}
                query={searchInput}
                onOpen={(t) => {
                  if (t.workspaceId === wsId) {
                    setOpenTask(tasks.find((x) => x.id === t.id) ?? null);
                  } else {
                    setPendingOpenTaskId(t.id);
                    setWsId(t.workspaceId);
                  }
                  closeSearch();
                }}
              />
            ) : active.length === 0 && completed.length === 0 ? (
              <p className="text-center text-sm text-ink-faint py-20">
                {searchOpen ? (
                  "見つかりませんでした。"
                ) : (
                  <>
                    まだタスクがありません。
                    <br />
                    余白を楽しみましょう。
                  </>
                )}
              </p>
            ) : (
              <>
                <ul>
                  {activeNodes.map((n) => (
                    <TaskItem
                      key={n.task.id}
                      task={n.task}
                      depth={n.depth}
                      childCount={n.childCount}
                      completedChildCount={n.completedChildCount}
                      assigneeName={
                        n.task.assigneeId ? memberNameById.get(n.task.assigneeId) : undefined
                      }
                      onToggle={toggleTask}
                      onOpen={setOpenTask}
                    />
                  ))}
                </ul>

                {completed.length > 0 && (
                  <div className="mt-10">
                    <button
                      onClick={() => setShowCompleted((v) => !v)}
                      className="text-xs text-ink-faint hover:text-ink transition-colors"
                    >
                      {showCompleted ? "▾" : "▸"} 完了済み（{completed.length}）
                    </button>
                    {showCompleted && (
                      <ul className="mt-2">
                        {completedNodes.map((n) => (
                          <TaskItem
                            key={n.task.id}
                            task={n.task}
                            depth={n.depth}
                            childCount={n.childCount}
                            completedChildCount={n.completedChildCount}
                            assigneeName={
                              n.task.assigneeId ? memberNameById.get(n.task.assigneeId) : undefined
                            }
                            onToggle={toggleTask}
                            onOpen={setOpenTask}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

      {/* ダイアログ群 */}
      {openTask && (
        <TaskDetail
          key={openTask.id}
          task={openTask}
          folders={folders}
          allTasks={tasks}
          members={currentWs?.members ?? []}
          onOpenTask={setOpenTask}
          onTasksChanged={mutateTasks}
          onSave={async (patch) => {
            await api(`/api/tasks/${openTask.id}`, "PATCH", patch);
            mutateTasks();
          }}
          onDelete={async () => {
            await api(`/api/tasks/${openTask.id}`, "DELETE");
            mutateTasks();
          }}
          onClose={() => setOpenTask(null)}
        />
      )}
      {showShare && currentWs && (
        <ShareDialog
          workspace={currentWs}
          meId={user.id}
          onChanged={() => {
            mutateWs();
            setWsId(null);
          }}
          onClose={() => setShowShare(false)}
        />
      )}
      {showSettings && settings && (
        <SettingsDialog
          settings={settings}
          userName={user.name}
          onSaved={() => mutateSettings()}
          onLogout={async () => {
            await api("/api/auth", "DELETE");
            localStorage.removeItem(WS_KEY);
            location.reload();
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {wsDialog && (
        <WorkspaceDialog
          mode={wsDialog}
          onDone={(newWsId) => {
            mutateWs();
            if (newWsId) setWsId(newWsId);
            setWsDialog(null);
          }}
          onClose={() => setWsDialog(null)}
        />
      )}
      {filterDialog && (
        <FilterDialog
          existing={filterDialog.mode === "edit" ? filterDialog.filter : null}
          folders={folders}
          onSaved={mutateFilters}
          onClose={() => setFilterDialog(null)}
        />
      )}
    </div>
  );
}

function SearchResults({
  loading,
  results,
  query,
  onOpen,
}: {
  loading: boolean;
  results: (Task & { workspaceName: string })[];
  query: string;
  onOpen: (t: Task & { workspaceName: string }) => void;
}) {
  if (!query.trim()) {
    return (
      <p className="text-center text-sm text-ink-faint py-20">
        キーワードを入力してください。
      </p>
    );
  }
  if (loading) {
    return <p className="text-center text-sm text-ink-faint py-20">検索中…</p>;
  }
  if (results.length === 0) {
    return (
      <p className="text-center text-sm text-ink-faint py-20">
        見つかりませんでした。
      </p>
    );
  }
  return (
    <ul>
      {results.map((t) => (
        <li key={t.id} className="border-b border-line/70 last:border-b-0">
          <button
            onClick={() => onOpen(t)}
            className="w-full text-left px-2 py-3 hover:bg-card/70 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm truncate ${t.completed ? "text-ink-faint line-through" : ""}`}>
                {t.title}
              </span>
            </div>
            <span className="text-[11px] text-ink-faint">{t.workspaceName}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function WorkspaceDialog({
  mode,
  onDone,
  onClose,
}: {
  mode: "create" | "join";
  onDone: (wsId: string | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res =
        mode === "create"
          ? await api("/api/workspaces", "POST", { name: value.trim() })
          : await api("/api/join", "POST", { code: value.trim() });
      onDone(res.workspace?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={mode === "create" ? "ワークスペースを作成" : "招待コードで参加"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label={mode === "create" ? "ワークスペース名" : "招待コード"}>
          <input
            autoFocus
            className={inputClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={mode === "create" ? "チームA" : "例: 3f2a9c81e0"}
          />
        </Field>
        {error && <p className="text-xs text-danger mb-3">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={!value.trim() || busy}>
            {mode === "create" ? "作成" : "参加"}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

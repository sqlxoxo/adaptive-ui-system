import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Check, 
  ChevronRight, 
  ChevronDown,
  Settings, 
  User as UserIcon, 
  Cpu, 
  Zap, 
  Activity, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Flame,
  MousePointer,
  Keyboard,
  ListFilter,
  Layers,
  CheckCircle,
  TrendingUp,
  X,
  PlusCircle,
  Play,
  Sun,
  Moon,
  Edit
} from "lucide-react";
import { Task, TelemetryMetrics, UIConfig } from "./types";
import OnboardingGuide from "./components/OnboardingGuide";
import Auth from "./components/Auth";

export default function App() {
  // Authentication states
  const [user, setUser] = useState<{ id: string; username: string; name: string; level: string } | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Theme state persisted in localStorage
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      if (stored) return stored === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Apply dark mode theme class dynamic effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  // Live Tasks and configuration states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<{ id: string; name: string }[]>([
    { id: "todo", name: "To Do" },
    { id: "inprogress", name: "In Progress" },
    { id: "done", name: "Done" }
  ]);
  const [uiConfig, setUiConfig] = useState<UIConfig>({
    level: "Novice",
    score: 15,
    showHelperTooltips: true,
    showInteractiveGuide: true,
    showSimpleView: true,
    showDetailedAnalytics: false,
    showAdvancedFilters: false,
    showQuickActionsPanel: false,
    buttonSize: "large"
  });

  // Telemetry metrics tracking
  const [telemetry, setTelemetry] = useState<TelemetryMetrics>({
    errorsCount: 0,
    hoverTime: 0,
    firstTaskDuration: 0,
    shortcutCount: 0,
    actionsCount: 0,
    totalTime: 0
  });

  // History state for UI rendering
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  // UI state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newStatus, setNewStatus] = useState<string>("todo");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "idle" | "error">("idle");
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [isTelemetryCollapsed, setIsTelemetryCollapsed] = useState<boolean>(false);
  const [isChartCollapsed, setIsChartCollapsed] = useState<boolean>(false);

  // Filters for Expert UI
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Trackers and timers references
  const hoverStartTimeRef = useRef<number | null>(null);
  const totalTimerRef = useRef<number>(0);
  const isDocCreatedYet = useRef<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Stale closures refs
  const tasksRef = useRef<Task[]>([]);
  const columnsRef = useRef<{ id: string; name: string }[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  // Custom authenticated fetch wrapper
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("auth_token");
    const headers = {
      ...(options.headers || {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    console.log("Спроба запиту на URL:", url);    
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error("Сесія завершилась. Будь ласка, увійдіть знову.");
    }
    return res;
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setTasks([]);
    setColumns([
      { id: "todo", name: "To Do" },
      { id: "inprogress", name: "In Progress" },
      { id: "done", name: "Done" }
    ]);
    setMetricsHistory([]);
    setTelemetry({
      errorsCount: 0,
      hoverTime: 0,
      firstTaskDuration: 0,
      shortcutCount: 0,
      actionsCount: 0,
      totalTime: 0
    });
  };

  // 1. Session verification on mount
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error("Session verification failed", err);
        handleLogout();
      } finally {
        setAuthLoading(false);
      }
    };
    verifySession();
  }, []);

  // 2. Load data and setup session resources once authenticated
  useEffect(() => {
    if (!user) return;

    fetchTasks();
    fetchColumns();
    fetchUIConfig();
    fetchHistory();

    // Setup global keydown listeners for expert shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input or textarea
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        if (e.key === "Escape") {
          setIsModalOpen(false);
        }
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTelemetry(prev => ({ ...prev, shortcutCount: prev.shortcutCount + 1 }));
        setEditingTaskId(null);
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
        setNewStatus(columnsRef.current[0]?.id || "todo");
        setValidationError(null);
        setIsModalOpen(true);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setTelemetry(prev => ({ ...prev, shortcutCount: prev.shortcutCount + 1 }));
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setTelemetry(prev => ({ ...prev, shortcutCount: prev.shortcutCount + 1 }));
        clearCompletedTasks();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Track timer for session
    const interval = setInterval(() => {
      totalTimerRef.current += 1;
      setTelemetry(prev => ({
        ...prev,
        totalTime: totalTimerRef.current
      }));
    }, 1000);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(interval);
    };
  }, [user]);

  // Periodic Telemetry Sync to server
  useEffect(() => {
    if (!user) return;
    
    // Sync telemetry to server every 12 seconds
    const syncInterval = setInterval(() => {
      syncTelemetry();
    }, 12000);

    return () => clearInterval(syncInterval);
  }, [telemetry, user]);

  // Fetch Tasks
  const fetchTasks = async () => {
    try {
      const res = await authenticatedFetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
      if (data.length > 3) {
        isDocCreatedYet.current = true;
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  };

  // Fetch columns from server
  const fetchColumns = async () => {
    try {
      const res = await authenticatedFetch("/api/columns");
      const data = await res.json();
      if (Array.isArray(data)) {
        setColumns(data);
      }
    } catch (err) {
      console.error("Failed to load columns", err);
    }
  };

  // Fetch interface state config
  const fetchUIConfig = async () => {
    try {
      const res = await authenticatedFetch("/api/ui-config");
      const data = await res.json();
      setUiConfig(data);
    } catch (err) {
      console.error("Failed to load ui config", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await authenticatedFetch("/api/metrics-history");
      const data = await res.json();
      setMetricsHistory(data.history || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Sync Telemetry
  const syncTelemetry = async (updatedMetrics?: TelemetryMetrics) => {
    if (!user) return;
    setSyncStatus("syncing");
    const payload = updatedMetrics || telemetry;
    try {
      const res = await authenticatedFetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorsCount: payload.errorsCount,
          hoverTime: Math.round(payload.hoverTime),
          firstTaskDuration: payload.firstTaskDuration,
          shortcutCount: payload.shortcutCount,
          actionsCount: payload.actionsCount,
          totalTime: payload.totalTime
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUiConfig(prev => ({
          ...prev,
          level: data.level,
          score: data.score,
          showHelperTooltips: data.level === "Novice",
          showInteractiveGuide: data.level === "Novice",
          showSimpleView: data.level === "Novice",
          showDetailedAnalytics: data.level === "Expert",
          showAdvancedFilters: data.level === "Expert",
          showQuickActionsPanel: data.level === "Expert",
          buttonSize: data.level === "Novice" ? "large" : "compact"
        }));
        setSyncStatus("idle");
        fetchHistory();
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  // Mouse hover events monitoring
  const handleMouseEnterWidget = () => {
    hoverStartTimeRef.current = Date.now();
  };

  const handleMouseLeaveWidget = () => {
    if (hoverStartTimeRef.current) {
      const elapsed = (Date.now() - hoverStartTimeRef.current) / 1000;
      setTelemetry(prev => {
        const nextMetrics = {
          ...prev,
          hoverTime: prev.hoverTime + elapsed
        };
        // Instant update feedback path for hover sync
        if (elapsed > 4) {
          syncTelemetry(nextMetrics);
        }
        return nextMetrics;
      });
      hoverStartTimeRef.current = null;
    }
  };

  // Start task editing
  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setNewTitle(task.title);
    setNewDescription(task.description || "");
    setNewPriority(task.priority);
    setNewStatus(task.status);
    setValidationError(null);
    setIsModalOpen(true);
  };

  // Save task (Create or Edit)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      // User error telemetry increment
      setValidationError("Помилка: Назва задачі є обов'язковим реквізитом!");
      const nextTelemetry = {
        ...telemetry,
        errorsCount: telemetry.errorsCount + 1,
        actionsCount: telemetry.actionsCount + 1
      };
      setTelemetry(nextTelemetry);
      syncTelemetry(nextTelemetry);
      return;
    }

    setValidationError(null);
    let updatedFirstTaskDuration = telemetry.firstTaskDuration;
    if (!isDocCreatedYet.current) {
      updatedFirstTaskDuration = totalTimerRef.current;
      isDocCreatedYet.current = true;
    }

    const nextTelemetry = {
      ...telemetry,
      firstTaskDuration: updatedFirstTaskDuration,
      actionsCount: telemetry.actionsCount + 1
    };
    setTelemetry(nextTelemetry);

    try {
      const url = editingTaskId ? `/api/tasks/${editingTaskId}` : "/api/tasks";
      const method = editingTaskId ? "PUT" : "POST";
      const res = await authenticatedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          status: newStatus,
          priority: newPriority
        })
      });

      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewPriority("medium");
        setNewStatus(columns[0]?.id || "todo");
        setEditingTaskId(null);
        setIsModalOpen(false);
        fetchTasks();
        syncTelemetry(nextTelemetry);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Modify task status
  const updateTaskStatus = async (id: string, newStatus: string) => {
    const nextTelemetry = {
      ...telemetry,
      actionsCount: telemetry.actionsCount + 1
    };
    setTelemetry(nextTelemetry);

    try {
      const res = await authenticatedFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTasks();
        syncTelemetry(nextTelemetry);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const deleteTask = async (id: string) => {
    const nextTelemetry = {
      ...telemetry,
      actionsCount: telemetry.actionsCount + 1
    };
    setTelemetry(nextTelemetry);

    try {
      const res = await authenticatedFetch(`/api/tasks/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTasks();
        syncTelemetry(nextTelemetry);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Clear completed tasks
  const clearCompletedTasks = async () => {
    const doneTasks = tasksRef.current.filter(t => t.status === "done");
    if (doneTasks.length === 0) return;

    const nextTelemetry = {
      ...telemetry,
      actionsCount: telemetry.actionsCount + doneTasks.length
    };
    setTelemetry(nextTelemetry);

    for (const task of doneTasks) {
      await authenticatedFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    }
    fetchTasks();
    syncTelemetry(nextTelemetry);
  };

  // Column management actions
  const handleAddColumn = async (name: string) => {
    if (!name.trim()) return;
    const newColId = "col_" + Date.now();
    const updatedCols = [...columns, { id: newColId, name: name.trim() }];
    
    try {
      const res = await authenticatedFetch("/api/columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updatedCols })
      });
      if (res.ok) {
        setColumns(updatedCols);
        setTelemetry(prev => ({ ...prev, actionsCount: prev.actionsCount + 1 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditingColumn = (colId: string, currentName: string) => {
    setEditingColumnId(colId);
    setEditingColumnName(currentName);
  };

  const saveColumnRename = async (colId: string) => {
    if (!editingColumnName.trim()) {
      setEditingColumnId(null);
      return;
    }
    const updatedCols = columns.map(c => c.id === colId ? { ...c, name: editingColumnName.trim() } : c);
    try {
      const res = await authenticatedFetch("/api/columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updatedCols })
      });
      if (res.ok) {
        setColumns(updatedCols);
        setEditingColumnId(null);
        setTelemetry(prev => ({ ...prev, actionsCount: prev.actionsCount + 1 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (columns.length <= 1) {
      alert("Не можна видалити останню колонку!");
      return;
    }
    if (!window.confirm("Ви впевнені, що хочете видалити цю колонку? Усі задачі з неї буде переміщено до першої колонки.")) {
      return;
    }
    const updatedCols = columns.filter(c => c.id !== colId);
    try {
      const res = await authenticatedFetch("/api/columns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: updatedCols })
      });
      if (res.ok) {
        setColumns(updatedCols);
        fetchTasks();
        setTelemetry(prev => ({ ...prev, actionsCount: prev.actionsCount + 1 }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Custom simulation trigger
  const handleLevelOverride = async (targetLevel: "Novice" | "Expert") => {
    try {
      const res = await authenticatedFetch("/api/telemetry/override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLevel })
      });
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data.activeTelemetry);
        setUiConfig(prev => ({
          ...prev,
          level: data.level,
          score: data.score,
          showHelperTooltips: data.level === "Novice",
          showInteractiveGuide: data.level === "Novice",
          showSimpleView: data.level === "Novice",
          showDetailedAnalytics: data.level === "Expert",
          showAdvancedFilters: data.level === "Expert",
          showQuickActionsPanel: data.level === "Expert",
          buttonSize: data.level === "Novice" ? "large" : "compact"
        }));
        fetchHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset metrics
  const handleResetMetrics = async () => {
    await handleLevelOverride("Novice");
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const titleVal = task.title ? task.title.toLowerCase() : "";
    const descVal = task.description ? task.description.toLowerCase() : "";
    const matchesSearch = titleVal.includes(searchQuery.toLowerCase()) || 
                          descVal.includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const todoTasks = filteredTasks.filter(t => t.status === "todo");
  const inProgressTasks = filteredTasks.filter(t => t.status === "inprogress");
  const doneTasks = filteredTasks.filter(t => t.status === "done");

  const isChartCollapsedState = !uiConfig.showDetailedAnalytics || isChartCollapsed;
  const isSidebarCollapsed = isTelemetryCollapsed && isChartCollapsedState;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold tracking-wide animate-pulse">Завантаження сесії...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onAuthSuccess={(token, userData) => {
          localStorage.setItem("auth_token", token);
          setUser(userData);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* 1. Header Banner */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Headline */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/10 dark:shadow-blue-500/5">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Smart Task Management System
                <span className="text-[10px] font-mono font-medium tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  v2.0 Adaptive
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Інформаційна система керування задачами з інтелектуальною адаптацією UI/UX
              </p>
            </div>
          </div>

          {/* User Profile Stat Dashboard & Theme Toggle */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex flex-1 md:flex-none flex-wrap items-center gap-2 sm:gap-4 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 font-mono text-xs justify-between md:justify-start w-full sm:w-auto">
              <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg shadow-2xs border border-slate-100 dark:border-slate-800 shrink-0" title={`Логін: ${user.username}`}>
                <UserIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">{user.name}</span>
              </div>
              
              {/* Live Indicator of Adaptive Level */}
              <div className="flex items-center gap-1.5 font-sans font-bold text-[13px] shrink-0">
                <span className="text-slate-500 dark:text-slate-400 font-normal mr-1">UI UX Level:</span>
                {uiConfig.level === "Expert" ? (
                  <span className="flex items-center gap-1 bg-teal-500 text-white px-3 py-1 rounded-full text-xs shadow-xs animate-bounce">
                    <Flame className="w-3.5 h-3.5 fill-current" /> Expert
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1 rounded-full text-xs shadow-xs">
                    <Activity className="w-3.5 h-3.5" /> Novice
                  </span>
                )}
              </div>

              {/* Score pill */}
              <div className="bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-200 font-mono text-center shrink-0">
                Score: {uiConfig.score}/100
              </div>
            </div>

            {/* Global Dark Mode & Logout Button Container */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="theme-toggle"
                onClick={() => setIsDark(!isDark)}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer shadow-sm shrink-0 flex items-center justify-center"
                title={isDark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600" />
                )}
              </button>

              <button
                onClick={handleLogout}
                className="px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-all cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5 font-sans font-semibold text-xs"
                title="Вийти з акаунта"
              >
                Вихід
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row transition-all duration-300 ${isSidebarCollapsed ? 'gap-0' : 'gap-6'}`}>
        
        {/* Left Grid: Workspace Board & Adaptive UI Widgets */}
        <section className="flex-1 flex flex-col gap-6 order-1 lg:order-2">
          
          {/* Dynamic Interactive Novice Guide */}
          {uiConfig.showInteractiveGuide && (
            <OnboardingGuide score={uiConfig.score} />
          )}

          {/* Expert UI Advanced Filters Toolbar */}
          {uiConfig.showAdvancedFilters && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-all duration-300">
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
                <div className="flex items-center gap-2 self-start">
                  <ListFilter className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-sans">Розширені фільтри (Expert Toolbar)</h3>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Real-time search */}
                  <div className="relative flex-1 sm:w-64 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Пошук задач... (натисніть S)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-all font-mono"
                    />
                  </div>

                  {/* Priority Filter */}
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-teal-500 outline-hidden font-mono cursor-pointer"
                  >
                    <option value="all">Усі пріоритети</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>

                  {/* Clear button */}
                  {(searchQuery || priorityFilter !== "all") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setPriorityFilter("all");
                      }}
                      className="text-xs text-red-600 dark:text-red-450 hover:text-red-700 dark:hover:text-red-400 font-semibold px-2 py-1 inline-flex items-center gap-1 cursor-pointer"
                    >
                      Скинути фільтри
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Kanban Board Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            
            {/* Board Header with Task Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                  <Layers className="w-5 h-5 text-slate-500 dark:text-slate-405" />
                  Дошка задач
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'задача' : 'задачі'} знайдено
                </p>
              </div>

              {/* Add Task Button (Size based on dynamic configuration) */}
              <div className="flex items-center gap-3">
                {isSidebarCollapsed && (
                  <button
                    onClick={() => {
                      setIsTelemetryCollapsed(false);
                      setIsChartCollapsed(false);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-955/30 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-xl text-xs border border-blue-200 dark:border-blue-900/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span>Показати телеметрію</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setEditingTaskId(null);
                    setNewTitle("");
                    setNewDescription("");
                    setNewPriority("medium");
                    setNewStatus(columns[0]?.id || "todo");
                    setValidationError(null);
                    setIsModalOpen(true);
                  }}
                  className={`flex items-center justify-center gap-2 font-bold cursor-pointer rounded-xl transition-all shadow-md focus:ring-2 focus:ring-offset-2 ${
                    uiConfig.buttonSize === "large" 
                      ? "px-6 py-3.5 bg-emerald-600 text-white hover:bg-emerald-700 text-sm focus:ring-emerald-500" 
                      : "px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs focus:ring-slate-700"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Створити задачу</span>
                  {uiConfig.showHelperTooltips && (
                    <span className="hidden sm:inline-block bg-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-mono font-medium animate-pulse ml-1 text-white">
                      Швидко!
                    </span>
                  )}
                </button>
              </div>
            </div>

             {/* Columns Row */}
            <div className="grid gap-5 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {columns.map((col) => {
                const colTasks = filteredTasks.filter(t => t.status === col.id);
                
                let colBg = "bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800";
                let headerText = "text-slate-600 dark:text-slate-350";
                let dotBg = "bg-slate-400";
                let emptyBg = "border-slate-300/60 dark:border-slate-700/50 bg-slate-100/40 dark:bg-slate-900/40 text-slate-450 dark:text-slate-500";
                let emptyText = "Немає задач";

                if (col.id === "todo") {
                  colBg = "bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800";
                  headerText = "text-slate-600 dark:text-slate-300";
                  dotBg = "bg-slate-400";
                  emptyText = "Немає задач на черзі";
                } else if (col.id === "inprogress") {
                  colBg = "bg-blue-50/50 dark:bg-blue-950/20 border-blue-100/70 dark:border-blue-900/30";
                  headerText = "text-blue-700 dark:text-blue-300";
                  dotBg = "bg-blue-500 animate-ping";
                  emptyBg = "border-blue-200/50 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 text-blue-400/85 dark:text-blue-400";
                  emptyText = "Немає активних задач";
                } else if (col.id === "done") {
                  colBg = "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30";
                  headerText = "text-emerald-700 dark:text-emerald-300";
                  dotBg = "bg-emerald-500";
                  emptyBg = "border-emerald-200/50 dark:border-emerald-900/40 bg-emerald-50/10 dark:bg-emerald-950/10 text-emerald-400/85 dark:text-emerald-400";
                  emptyText = "Пусто";
                } else {
                  colBg = "bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100/60 dark:border-indigo-900/20";
                  headerText = "text-indigo-700 dark:text-indigo-300";
                  dotBg = "bg-indigo-500";
                  emptyBg = "border-indigo-200/40 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-950/5 text-indigo-400 dark:text-indigo-455";
                  emptyText = "Тут немає задач";
                }

                return (
                  <div 
                    key={col.id}
                    className={`${colBg} rounded-xl p-4 border flex flex-col`}
                    onMouseEnter={handleMouseEnterWidget}
                    onMouseLeave={handleMouseLeaveWidget}
                  >
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="flex-1 min-w-0 pr-2">
                        {editingColumnId === col.id ? (
                          <input
                            type="text"
                            value={editingColumnName}
                            onChange={(e) => setEditingColumnName(e.target.value)}
                            onBlur={() => saveColumnRename(col.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveColumnRename(col.id);
                              if (e.key === "Escape") setEditingColumnId(null);
                            }}
                            className="w-full text-xs font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 focus:outline-hidden"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 group/col">
                            <span 
                              className={`inline-flex items-center gap-2 text-xs font-semibold ${headerText} font-mono tracking-wider truncate cursor-pointer`}
                              onDoubleClick={() => startEditingColumn(col.id, col.name)}
                              title="Двічі клацніть, щоб перейменувати"
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${dotBg} inline-block shrink-0`} />
                              {col.name.toUpperCase()} ({colTasks.length})
                            </span>
                            
                            <div className="opacity-0 group-hover/col:opacity-100 focus-within:opacity-100 flex items-center gap-1 transition-all ml-1 shrink-0">
                              <button
                                onClick={() => startEditingColumn(col.id, col.name)}
                                title="Перейменувати колонку"
                                className="text-slate-400 hover:text-blue-555 dark:hover:text-blue-400 p-0.5"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              {columns.length > 1 && (
                                <button
                                  onClick={() => handleDeleteColumn(col.id)}
                                  title="Вилучити колонку"
                                  className="text-slate-400 hover:text-red-500 p-0.5"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {uiConfig.showHelperTooltips && (
                        <HelpCircle 
                          className="w-4 h-4 text-slate-400 dark:text-slate-500 cursor-pointer hover:text-blue-500 shrink-0"
                          onMouseEnter={() => setActiveTooltip(col.id)}
                          onMouseLeave={() => setActiveTooltip(null)}
                        />
                      )}
                    </div>

                    {activeTooltip === col.id && uiConfig.showHelperTooltips && (
                      <div className="bg-slate-900 text-white text-[11px] p-2 rounded-lg absolute z-50 max-w-xs -mt-2 shadow-lg">
                        {col.id === "todo" && "Задачі, які потрібно зробити. Сюди автоматично потрапляють нові елементи."}
                        {col.id === "inprogress" && "Задачі, які зараз активно виконуються або розробляються в цей момент."}
                        {col.id === "done" && "Виконані задачі. Оцінка за швидке виконання підсумовується!"}
                        {col.id !== "todo" && col.id !== "inprogress" && col.id !== "done" && `Користувацька колонка: ${col.name}.`}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 min-h-[220px]">
                      {colTasks.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-xl ${emptyBg}`}>
                          <p className="text-xs">{emptyText}</p>
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            uiConfig={uiConfig}
                            columns={columns}
                            onDelete={deleteTask}
                            onEdit={startEditingTask}
                            onStatusChange={updateTaskStatus}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Column Card */}
              <div className="bg-slate-100/50 dark:bg-slate-900/30 rounded-xl p-4 border border-dashed border-slate-350 dark:border-slate-800 flex flex-col justify-center items-center min-h-[200px]">
                <div className="w-full text-center">
                  <h3 className="text-xs font-bold text-slate-550 dark:text-slate-400 mb-2 uppercase tracking-wider">
                    Нова колонка
                  </h3>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem("colName") as HTMLInputElement;
                      if (input.value.trim()) {
                        handleAddColumn(input.value.trim());
                        input.value = "";
                      }
                    }}
                    className="space-y-2"
                  >
                    <input
                      name="colName"
                      type="text"
                      placeholder="Назва..."
                      className="w-full bg-white dark:bg-slate-800 text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans text-slate-800 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Додати колонку
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>

          {/* Expert - Dynamic Quick Keyboard Action Cheat Sheet Panel */}
          {uiConfig.showQuickActionsPanel && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-700/60 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-teal-400" />
                  <span className="font-bold text-sm tracking-wide text-white font-sans">Expert Quick Actions Panel</span>
                </div>
                <span className="text-[10px] bg-teal-500 hover:bg-teal-600 cursor-pointer text-slate-950 font-bold font-mono px-2 py-0.5 rounded-full transition-all">
                  Hotkeys Enabled
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed font-sans">
                Заощаджуйте час, використовуючи глобальні швидкі клавіші. Кожне натискання фіксується системою телеметрії:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-800/80 rounded px-2.5 py-2 border border-slate-700/40 flex justify-between items-center font-sans">
                  <span className="text-slate-300">Створити нову задачу</span>
                  <span className="bg-slate-700 text-white px-2 py-0.5 rounded font-mono font-semibold ring-1 ring-white/10 shadow-xs">N</span>
                </div>
                <div className="bg-slate-800/80 rounded px-2.5 py-2 border border-slate-700/40 flex justify-between items-center font-sans">
                  <span className="text-slate-300">Фокус на полі пошуку</span>
                  <span className="bg-slate-700 text-white px-2 py-0.5 rounded font-mono font-semibold ring-1 ring-white/10 shadow-xs">S</span>
                </div>
                <div className="bg-slate-800/80 rounded px-2.5 py-2 border border-slate-700/40 flex justify-between items-center font-sans">
                  <span className="text-slate-300">Очистити виконані</span>
                  <span className="bg-slate-700 text-white px-2 py-0.5 rounded font-mono font-semibold ring-1 ring-white/10 shadow-xs font-sans">C</span>
                </div>
              </div>

              {/* Advanced Bulk Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-2.5 justify-between items-center">
                <span className="text-[11px] text-slate-400 font-sans">Швидкі пресети:</span>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={clearCompletedTasks}
                    className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 py-1 px-2.5 rounded text-xs transition-all inline-flex items-center gap-1 cursor-pointer font-medium font-sans"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Очистити виконані (Done)
                  </button>
                </div>
              </div>
            </div>
          )}

        </section>        {/* Right Grid: Behavior Sandbox, AI Analysis, Performance Graphs */}
        {!isSidebarCollapsed && (
          <section 
            className="w-full lg:w-80 shrink-0 flex flex-col gap-6 order-2 lg:order-1"
            onMouseEnter={handleMouseEnterWidget}
            onMouseLeave={handleMouseLeaveWidget}
          >
            
            {/* A. Live Telemetry Monitor (Sandbox Controls) */}
            <div className="bg-white dark:bg-slate-900 border text-xs border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all duration-300">
              <div 
                onClick={() => setIsTelemetryCollapsed(!isTelemetryCollapsed)}
                className="flex items-center justify-between cursor-pointer select-none pb-1"
              >
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-450 shrink-0" />
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider font-sans">
                    Телеметрія поведінки
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 px-2 py-0.5 rounded-full text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
                    <span className="text-slate-500 dark:text-slate-400 capitalize">{syncStatus}</span>
                  </div>
                  {isTelemetryCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                  )}
                </div>
              </div>

              {!isTelemetryCollapsed && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/80">
                    Ця панель фоново відстежує дії користувача та кожні 12 секунд синхронізує метрики з інтелектуальним бекендом.
                  </p>

                  {/* Live Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl">
                      <div className="text-slate-500 dark:text-rose-300/90 text-[10px] uppercase font-bold tracking-wider">Помилки валідації</div>
                      <div className="text-xl font-mono font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center justify-between">
                        {telemetry.errorsCount}
                        {telemetry.errorsCount > 0 && <AlertCircle className="w-4 h-4 stroke-2" />}
                      </div>
                      <div className="text-[9px] text-rose-500 dark:text-rose-450 mt-0.5">Пусті збереження</div>
                    </div>

                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                      <div className="text-slate-500 dark:text-amber-300/90 text-[10px] uppercase font-bold tracking-wider">Wandering Mouse</div>
                      <div className="text-xl font-mono font-bold text-amber-700 dark:text-amber-450 mt-1 flex items-center justify-between">
                        {Math.round(telemetry.hoverTime)}s
                        <MousePointer className="w-4 h-4 stroke-2" />
                      </div>
                      <div className="text-[9px] text-amber-600 dark:text-amber-400/80 mt-0.5">Блукання над кнопками</div>
                    </div>

                    <div className="p-2.5 bg-sky-50 dark:bg-sky-955/20 border border-sky-100 dark:border-sky-900/30 rounded-xl">
                      <div className="text-slate-500 dark:text-sky-300/90 text-[10px] uppercase font-bold tracking-wider">Швидкість старту</div>
                      <div className="text-xl font-mono font-bold text-sky-700 dark:text-sky-450 mt-1">
                        {telemetry.firstTaskDuration === 0 ? "В очікуванні..." : `${telemetry.firstTaskDuration}s`}
                      </div>
                      <div className="text-[9px] text-sky-500 dark:text-sky-400 mt-0.5">Створення 1-ї задачі</div>
                    </div>

                    <div className="p-2.5 bg-teal-50 dark:bg-teal-955/20 border border-teal-100 dark:border-teal-900/30 rounded-xl">
                      <div className="text-slate-500 dark:text-teal-300/90 text-[10px] uppercase font-bold tracking-wider">Гарячі клавіші</div>
                      <div className="text-xl font-mono font-bold text-teal-700 dark:text-teal-450 mt-1 flex items-center justify-between">
                        {telemetry.shortcutCount}
                        <Keyboard className="w-4 h-4 stroke-2" />
                      </div>
                      <div className="text-[9px] text-teal-600 dark:text-teal-450 mt-0.5">N, S, C або Esc</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>Журнал дій: {telemetry.actionsCount}</span>
                      <span>На екрані: {telemetry.totalTime}с</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, (telemetry.actionsCount/30)*100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Developer/Evaluation Simulator Switchers */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white block mb-2 uppercase tracking-wide font-sans">
                      Симулятор адаптивності інтерфейсу
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLevelOverride("Novice")}
                        className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer font-bold font-sans text-xs ${
                          uiConfig.level === "Novice"
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-900/60 font-bold shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        Новачок (Novice)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLevelOverride("Expert")}
                        className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer font-bold font-sans text-xs ${
                          uiConfig.level === "Expert"
                            ? "bg-teal-500 dark:bg-teal-600 text-white border-teal-600 dark:border-teal-700 font-bold shadow-xs"
                            : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        Експерт (Expert)
                      </button>
                    </div>

                    <button
                      onClick={handleResetMetrics}
                      className="w-full mt-2 py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-center transition-all font-mono text-[10px] inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Скинути телеметрію до 0
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* C. Live Performance Trend Charts (Available for Expert) */}
            {uiConfig.showDetailedAnalytics ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all duration-300">
                <div 
                  onClick={() => setIsChartCollapsed(!isChartCollapsed)}
                  className="flex items-center justify-between cursor-pointer select-none pb-1 border-b border-slate-100 dark:border-slate-800 mb-3"
                >
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider font-sans">
                      Аналітика навичок (Expert)
                    </h3>
                  </div>
                  {isChartCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                  )}
                </div>
                
                {!isChartCollapsed && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* SVG Live Skill Score Chart */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>Динаміка оцінки (Score Trend)</span>
                        <span className="font-bold text-teal-700 dark:text-teal-400">{uiConfig.score}%</span>
                      </div>
                      
                      {metricsHistory.length > 1 ? (
                        <div className="h-28 bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex items-end justify-between gap-1.5 overflow-hidden">
                          {metricsHistory.map((pt, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                              {/* Tooltip on Hover */}
                              <div className="absolute bottom-full mb-1 bg-slate-900 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                {pt.score}% ({pt.time})
                              </div>
                              {/* Visual Bar */}
                              <div 
                                className="w-full bg-teal-500 group-hover:bg-teal-600 rounded-xs transition-all pointer-events-none"
                                style={{ height: `${Math.max(4, pt.score)}%` }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-955 text-[10px] text-slate-400">
                          Недостатньо історичних точок
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1.5 text-right font-mono">
                        Автоматичне оновлення з кожним логом
                      </span>
                    </div>

                    {/* Performance stats progress */}
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-600 dark:text-slate-405 font-semibold font-mono">
                        Оптимальність інтерфейсу:
                      </div>
                      <div className="text-xs bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400">Помилки/Дії</span>
                          <span className={telemetry.errorsCount > telemetry.actionsCount * 0.2 ? "text-rose-600 dark:text-rose-450 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                            {telemetry.errorsCount} / {telemetry.actionsCount}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 dark:text-slate-400">Час вагань / дія</span>
                          <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">
                            {telemetry.actionsCount > 0 ? `${(telemetry.hoverTime / telemetry.actionsCount).toFixed(1)}с` : "0с"}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              /* Novice Blocked Chart state with prompt placeholder */
              <div className="bg-slate-50/75 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-5 text-center flex flex-col items-center justify-center opacity-75">
                <TrendingUp className="w-8 h-8 text-slate-400/80 dark:text-slate-600 mb-2.5" />
                <h4 className="text-xs font-bold text-slate-705 dark:text-slate-300">Аналітичний графік заблокований</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xs">
                  Експертні звіти та графіки приховані для зменшення зорового відволікання та спрощення старту.
                </p>
                <div className="mt-4 text-[10px] bg-sky-50 dark:bg-sky-955/30 text-sky-700 dark:text-sky-300 px-2.5 py-1 rounded-full font-semibold">
                  Підніміть Score &gt; 50 для активації
                </div>
              </div>
            )}

          </section>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-xs text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
          <p>© 2026 Smart Task Management system. Усі права застережено.</p>
          <div className="flex gap-4">
            <span className="text-slate-500">Демонстрація Adaptive UI/UX</span>
            <span>•</span>
            <span className="text-slate-500">Python + React Fullstack</span>
          </div>
        </div>
      </footer>

      {/* 5. Create Task Dialog Modal window */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all duration-300 max-h-[calc(100vh-2rem)] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingTaskId ? "Редагувати задачу" : "Створити нову задачу"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editingTaskId ? "Змініть параметри та збережіть зміни." : "Додайте задачу до планового списку."}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold cursor-pointer font-mono"
              >
                ESC Закрити
              </button>
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border-y border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 p-3.5 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-450" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateTask} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Task Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                  Назва задачі <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Введіть заголовок роботи..."
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-955 text-xs border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans text-slate-900 dark:text-white font-semibold"
                />
                {uiConfig.showHelperTooltips && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Обов'язково заповніть назву. Без неї система додасть помилку до вашого баллу.
                  </p>
                )}
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                  Опис або нотатки (Опціонально)
                </label>
                <textarea
                  placeholder="Додайте деталі задачі..."
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-955 text-xs border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans text-slate-850 dark:text-slate-200"
                />
              </div>

              {/* Status and Priority Columns - Stacks on mobile, inline on normal screen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Status selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                    Поточний status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden tracking-wide font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                    Важливість (Пріоритет)
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden tracking-wide font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="low">Низький (Low)</option>
                    <option value="medium">Середній (Medium)</option>
                    <option value="high">Високий (High)</option>
                  </select>
                </div>

              </div>

              {/* Submit panel actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-blue-500/10 inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingTaskId ? "Зберегти" : "Створити"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

// 6. Subcomponent: Custom Task Visual Card with responsive adaptive controls
interface TaskCardProps {
  key?: string;
  task: Task;
  uiConfig: UIConfig;
  columns: { id: string; name: string }[];
  onDelete: (id: string) => any;
  onEdit: (task: Task) => any;
  onStatusChange: (id: string, status: string) => any;
}

function TaskCard({ task, uiConfig, columns, onDelete, onEdit, onStatusChange }: TaskCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Helper colors for priorities
  const priorityStyles = {
    high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
    medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
    low: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
  };

  return (
    <div 
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:border-blue-300 dark:hover:border-blue-750 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 relative group overflow-hidden"
    >
      {/* Priority label tag */}
      <div className="flex justify-between items-center gap-2 mb-2">
        <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${priorityStyles[task.priority]}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
          <button
            onClick={() => onEdit(task)}
            title="Редагувати задачу"
            className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 p-1 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            title="Вилучити задачу"
            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans line-clamp-1">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Task Creation Date */}
      <div className="text-[9px] text-slate-400/80 dark:text-slate-500/80 font-mono mt-3">
        Додано: {new Date(task.createdAt).toLocaleTimeString()}
      </div>

      {/* Adaptive quick actions layout inside card */}
      <div className="mt-3.5 pt-2 border-t border-slate-100/70 dark:border-slate-800 flex items-center justify-between gap-2">
        
        {/* Simple visual helpers info for Novices */}
        {uiConfig.showSimpleView ? (
          <div className="flex flex-wrap gap-1.5 w-full justify-between items-center">
            {columns.map(col => {
              if (task.status === col.id) return null;
              
              let btnClass = "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300";
              if (col.id === "inprogress") btnClass = "bg-sky-100 hover:bg-sky-200 text-sky-700 dark:bg-sky-955/40 dark:text-sky-300";
              if (col.id === "done") btnClass = "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600";
              
              if (col.id !== "todo" && col.id !== "inprogress" && col.id !== "done") {
                btnClass = "bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300";
              }
              
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onStatusChange(task.id, col.id)}
                  className={`${btnClass} rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold inline-flex items-center gap-1 transition-all`}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  {col.name}
                </button>
              );
            })}
          </div>
        ) : (
          /* High-density layout for experts */
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 capitalize font-medium italic">
              Status: <strong className="text-slate-600 dark:text-slate-300">{columns.find(c => c.id === task.status)?.name || task.status}</strong>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 dark:text-slate-400 mr-1">Перемістити:</span>
              <select
                value={task.status}
                onChange={(e: any) => onStatusChange(task.id, e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-0.5 px-1.5 rounded text-[10px] focus:ring-1 focus:ring-teal-500 outline-hidden font-bold cursor-pointer"
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

      </div>

      {showTooltip && uiConfig.showHelperTooltips && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl max-w-[140px] text-center font-sans z-50">
          Змінює поточний статус цієї задачі в колонках
        </div>
      )}

    </div>
  );
}

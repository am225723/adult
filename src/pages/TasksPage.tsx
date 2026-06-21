import { useState, useRef, useEffect } from "react";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Calendar,
  Flag,
  Circle,
  CheckCircle2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useTasks,
  useSubtasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useProjects,
  useCreateProject,
  type Task,
  type TaskPriority,
} from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";

type TaskTab = "today" | "upcoming" | "overdue" | "all" | "completed";

const TABS: { key: TaskTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-blue-400",
  none: "text-muted-foreground",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

// ── Quick capture ──────────────────────────────────────────────────────────────

function QuickCapture({
  onAdd,
  projectId,
}: {
  onAdd: (title: string) => void;
  projectId?: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <form
      className="flex items-center gap-2 px-4 py-2 border-b border-border"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Plus size={14} className="text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task…"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value.trim() && (
        <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs">
          Add
        </Button>
      )}
    </form>
  );
}

// ── Priority picker ────────────────────────────────────────────────────────────

function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const priorities: TaskPriority[] = ["high", "medium", "low", "none"];

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors",
          PRIORITY_COLORS[value],
        )}
        onClick={() => setOpen((o) => !o)}
        title={`Priority: ${PRIORITY_LABELS[value]}`}
      >
        <Flag size={12} />
      </button>
      {open && (
        <div
          className="absolute z-20 right-0 mt-1 w-32 rounded-lg border border-border bg-popover shadow-md py-1"
          onBlur={() => setOpen(false)}
        >
          {priorities.map((p) => (
            <button
              key={p}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted",
                PRIORITY_COLORS[p],
              )}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
            >
              <Flag size={11} />
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  depth = 0,
}: {
  task: Task;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [addingSub, setAddingSub] = useState(false);

  const { data: subtasks = [] } = useSubtasks(task.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();

  const isDone = task.status === "done";

  function toggleDone() {
    updateTask.mutate({
      id: task.id,
      status: isDone ? "open" : "done",
      completed_at: isDone ? null : new Date().toISOString(),
    });
  }

  function saveTitle() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setEditing(false);
      setEditTitle(task.title);
      return;
    }
    updateTask.mutate(
      { id: task.id, title: trimmed },
      {
        onError: () => {
          toast({ variant: "destructive", title: "Failed to update task" });
          setEditTitle(task.title);
        },
      },
    );
    setEditing(false);
  }

  function handleDelete() {
    deleteTask.mutate(task.id, {
      onError: () =>
        toast({ variant: "destructive", title: "Failed to delete task" }),
    });
  }

  async function addSubtask(title: string) {
    try {
      await createTask.mutateAsync({ title, parent_task_id: task.id });
      setExpanded(true);
      setAddingSub(false);
    } catch {
      toast({ variant: "destructive", title: "Failed to add subtask" });
    }
  }

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue =
    dueDate && dueDate < new Date() && task.status !== "done";

  return (
    <div className={cn("group", depth > 0 && "ml-6 border-l border-border pl-3")}>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-muted/50 transition-colors",
          isDone && "opacity-50",
        )}
      >
        {/* Expand subtasks toggle */}
        <button
          className={cn(
            "w-4 h-4 shrink-0 flex items-center justify-center text-muted-foreground",
            subtasks.length === 0 && "invisible",
          )}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Checkbox */}
        <button
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          onClick={toggleDone}
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone ? (
            <CheckCircle2 size={16} className="text-primary" />
          ) : (
            <Circle size={16} />
          )}
        </button>

        {/* Title */}
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setEditing(false);
                setEditTitle(task.title);
              }
            }}
            className="flex-1 bg-transparent text-sm outline-none"
          />
        ) : (
          <span
            className={cn(
              "flex-1 text-sm cursor-text select-none",
              isDone && "line-through text-muted-foreground",
            )}
            onDoubleClick={() => setEditing(true)}
          >
            {task.title}
          </span>
        )}

        {/* Subtask count */}
        {subtasks.length > 0 && !expanded && (
          <span className="text-[11px] text-muted-foreground">
            {subtasks.filter((s) => s.status === "done").length}/{subtasks.length}
          </span>
        )}

        {/* Due date */}
        {dueDate && (
          <span
            className={cn(
              "text-[11px] flex items-center gap-0.5 shrink-0",
              isOverdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <Calendar size={10} />
            {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}

        {/* Priority */}
        <PriorityPicker
          value={task.priority as TaskPriority}
          onChange={(p) => updateTask.mutate({ id: task.id, priority: p })}
        />

        {/* Actions (on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setAddingSub((a) => !a)}
            title="Add subtask"
          >
            <Plus size={11} />
          </button>
          <button
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-muted"
            onClick={handleDelete}
            title="Delete task"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Add subtask input */}
      {addingSub && (
        <div className="ml-10 mr-3 mb-1">
          <Input
            autoFocus
            placeholder="Subtask title…"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                addSubtask(e.currentTarget.value.trim());
              }
              if (e.key === "Escape") setAddingSub(false);
            }}
            onBlur={() => setAddingSub(false)}
          />
        </div>
      )}

      {/* Subtasks */}
      {expanded && subtasks.length > 0 && (
        <div className="mt-0.5">
          {subtasks.map((sub) => (
            <TaskRow key={sub.id} task={sub} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Projects sidebar ───────────────────────────────────────────────────────────

function ProjectsSidebar({
  selectedProject,
  onSelect,
}: {
  selectedProject: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function handleAdd() {
    const name = newName.trim();
    if (!name || createProject.isPending) return;
    createProject.mutate({ name }, {
      onSuccess: () => {
        setNewName("");
        setAdding(false);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create project" }),
    });
  }

  return (
    <div className="w-44 shrink-0 border-r border-border flex flex-col">
      <div className="px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Projects
        </p>

        <button
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm",
            !selectedProject
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50",
          )}
          onClick={() => onSelect(undefined)}
        >
          All tasks
        </button>

        {projects.map((p) => (
          <button
            key={p.id}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm truncate",
              selectedProject === p.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => onSelect(p.id)}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: p.color ?? "#888" }}
            />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Add project */}
      {adding ? (
        <div className="px-3">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => {
              if (newName.trim()) handleAdd();
              else setAdding(false);
            }}
          />
        </div>
      ) : (
        <button
          className="mx-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-2"
          onClick={() => setAdding(true)}
        >
          <Plus size={11} />
          New project
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function TasksPage() {
  const [tab, setTab] = useState<TaskTab>("today");
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const { data: tasks = [], isLoading } = useTasks(tab, selectedProject);
  const createTask = useCreateTask();

  function handleAdd(title: string) {
    const today = new Date();
    today.setHours(23, 59, 59, 0);
    createTask.mutate(
      {
        title,
        project_id: selectedProject,
        due_date: tab === "today" ? today.toISOString() : undefined,
      },
      {
        onError: () =>
          toast({ variant: "destructive", title: "Failed to add task" }),
      },
    );
  }

  const overdueTasks = tasks.filter((t) => {
    if (tab !== "all" && tab !== "overdue") return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < new Date() && t.status !== "done";
  });

  return (
    <div className="flex h-screen">
      <ProjectsSidebar
        selectedProject={selectedProject}
        onSelect={setSelectedProject}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-4 pt-4 pb-2 border-b border-border shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
                tab === key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Quick capture */}
        {tab !== "completed" && (
          <QuickCapture onAdd={handleAdd} projectId={selectedProject} />
        )}

        {/* Task list */}
        <div className="flex-1 overflow-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <div className="space-y-0.5">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: TaskTab }) {
  const messages: Record<TaskTab, { title: string; sub: string }> = {
    today: { title: "Nothing due today", sub: "Add a task above to get started." },
    upcoming: { title: "No upcoming tasks", sub: "You're all caught up!" },
    overdue: { title: "No overdue tasks", sub: "Great work keeping on top of things." },
    all: { title: "No tasks yet", sub: "Add your first task above." },
    completed: { title: "No completed tasks yet", sub: "Complete tasks to see them here." },
  };
  const { title, sub } = messages[tab];
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <FolderOpen size={32} strokeWidth={1.25} className="text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
  FileText,
  Tag,
  X,
  UserCircle,
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
import { useWorkspaceUsers, type WorkspaceUser } from "@/hooks/useWorkspaceUsers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/useToast";

type TaskTab = "today" | "upcoming" | "overdue" | "all" | "mine" | "unassigned" | "completed";

const TABS: { key: TaskTab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
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

const TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
];

function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

// ── Quick capture ──────────────────────────────────────────────────────────────

function QuickCapture({
  onAdd,
}: {
  onAdd: (title: string) => void;
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

// ── Assignee avatar ────────────────────────────────────────────────────────────

function AssigneeAvatar({ user }: { user: WorkspaceUser }) {
  const initials = (user.display_name ?? user.email ?? "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      title={user.display_name ?? user.email ?? "Assigned"}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold shrink-0"
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={initials} className="w-5 h-5 rounded-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  depth = 0,
  onSelect,
  selectedId,
  userMap,
}: {
  task: Task;
  depth?: number;
  onSelect: (task: Task) => void;
  selectedId?: string;
  userMap: Map<string, WorkspaceUser>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);

  const { data: subtasks = [] } = useSubtasks(task.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();

  const isDone = task.status === "done";
  const isSelected = selectedId === task.id;

  function toggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    updateTask.mutate({
      id: task.id,
      status: isDone ? "open" : "done",
      completed_at: isDone ? null : new Date().toISOString(),
    });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
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

  const tags = task.tags?.filter(Boolean) ?? [];

  return (
    <div className={cn("group", depth > 0 && "ml-6 border-l border-border pl-3")}>
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer",
          isDone && "opacity-50",
          isSelected && "bg-muted",
        )}
        onClick={() => onSelect(task)}
      >
        {/* Expand subtasks toggle */}
        <button
          className={cn(
            "w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center text-muted-foreground",
            subtasks.length === 0 && "invisible",
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Checkbox */}
        <button
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          onClick={toggleDone}
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
        >
          {isDone ? (
            <CheckCircle2 size={16} className="text-primary" />
          ) : (
            <Circle size={16} />
          )}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm select-none",
                isDone && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </span>
            {/* Subtask count badge */}
            {subtasks.length > 0 && !expanded && (
              <span className="text-[11px] text-muted-foreground shrink-0">
                {subtasks.filter((s) => s.status === "done").length}/{subtasks.length}
              </span>
            )}
          </div>
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", tagColor(tag))}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {/* Notes preview */}
          {task.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {task.notes}
            </p>
          )}
        </div>

        {/* Right-side meta */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {/* Notes indicator */}
          {task.notes && (
            <FileText size={11} className="text-muted-foreground/60" />
          )}

          {/* Assignee avatar */}
          {task.assigned_to && userMap.has(task.assigned_to) && (
            <AssigneeAvatar user={userMap.get(task.assigned_to)!} />
          )}

          {/* Due date */}
          {dueDate && (
            <span
              className={cn(
                "text-[11px] flex items-center gap-0.5",
                isOverdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Calendar size={10} />
              {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}

          {/* Priority */}
          <div onClick={(e) => e.stopPropagation()}>
            <PriorityPicker
              value={task.priority as TaskPriority}
              onChange={(p) => updateTask.mutate({ id: task.id, priority: p })}
            />
          </div>

          {/* Actions (on hover) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                setAddingSub((a) => !a);
              }}
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
            <TaskRow
              key={sub.id}
              task={sub}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              userMap={userMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task detail panel ──────────────────────────────────────────────────────────

function TaskDetail({
  task,
  onClose,
  userMap,
}: {
  task: Task;
  onClose: () => void;
  userMap: Map<string, WorkspaceUser>;
}) {
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: projects = [] } = useProjects();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(task.tags ?? []);
  const [dueDate, setDueDate] = useState(
    task.due_date ? task.due_date.substring(0, 10) : "",
  );
  const [priority, setPriority] = useState<TaskPriority>(task.priority as TaskPriority);
  const [assignedTo, setAssignedTo] = useState<string>(task.assigned_to ?? "");

  // Reset state when task changes
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setTags(task.tags ?? []);
    setDueDate(task.due_date ? task.due_date.substring(0, 10) : "");
    setPriority(task.priority as TaskPriority);
    setAssignedTo(task.assigned_to ?? "");
  }, [task.id]);

  const save = useCallback(
    (patch: Partial<Omit<Task, "id">>) => {
      updateTask.mutate(
        { id: task.id, ...patch },
        {
          onError: () =>
            toast({ variant: "destructive", title: "Failed to save" }),
        },
      );
    },
    [task.id, updateTask],
  );

  function handleTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      return;
    }
    if (trimmed !== task.title) save({ title: trimmed });
  }

  function handleNotesBlur() {
    if (notes !== (task.notes ?? "")) save({ notes: notes || null });
  }

  function handleDueDateChange(val: string) {
    setDueDate(val);
    const iso = val ? new Date(val + "T23:59:59").toISOString() : null;
    save({ due_date: iso });
  }

  function handlePriorityChange(p: TaskPriority) {
    setPriority(p);
    save({ priority: p });
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    save({ tags: next });
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    save({ tags: next });
  }

  async function handleAssigneeChange(newId: string) {
    const prev = task.assigned_to;
    const next = newId || null;
    setAssignedTo(newId);

    try {
      await updateTask.mutateAsync({ id: task.id, assigned_to: next });
    } catch {
      toast({ variant: "destructive", title: "Failed to save" });
      setAssignedTo(prev ?? "");
      return;
    }

    if (next && next !== prev && next !== user?.id) {
      try {
        await supabase.from("admin_notifications").insert({
          workspace_id: task.workspace_id,
          user_id: next,
          type: "task_assigned",
          title: "Task assigned to you",
          body: task.title,
          related_type: "task",
          related_id: task.id,
          is_read: false,
        });
      } catch {
        // notification failure is non-critical
      }
    }
  }

  function handleDelete() {
    deleteTask.mutate(task.id, {
      onSuccess: onClose,
      onError: () =>
        toast({ variant: "destructive", title: "Failed to delete task" }),
    });
  }

  return (
    <div className="w-80 md:w-96 shrink-0 md:border-l border-t md:border-t-0 border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Task detail
        </span>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Title
          </label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            rows={2}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <FileText size={11} />
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={4}
            placeholder="Add notes…"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Tag size={11} />
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                  tagColor(tag),
                )}
              >
                {tag}
                <button
                  className="opacity-60 hover:opacity-100"
                  onClick={() => removeTag(tag)}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add tag, press Enter…"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Due date */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Calendar size={11} />
            Due date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Flag size={11} />
            Priority
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {(["high", "medium", "low", "none"] as TaskPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  priority === p
                    ? cn("border-transparent", PRIORITY_COLORS[p], "bg-muted")
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Project
            </label>
            <select
              value={task.project_id ?? ""}
              onChange={(e) =>
                save({ project_id: e.target.value || null })
              }
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Assignee */}
        {userMap.size > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <UserCircle size={11} />
              Assignee
            </label>
            <select
              value={assignedTo}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="">Unassigned</option>
              {Array.from(userMap.values()).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name ?? u.email ?? u.id}
                  {u.id === user?.id ? " (me)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <Trash2 size={12} />
          Delete task
        </button>
      </div>
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
    <div className="hidden md:flex w-44 shrink-0 border-r border-border flex-col">
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
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TaskTab>("today");
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { data: tasks = [], isLoading } = useTasks(tab, selectedProject);
  const { data: workspaceUsers = [] } = useWorkspaceUsers();
  const createTask = useCreateTask();

  const userMap = useMemo(
    () => new Map(workspaceUsers.map((u) => [u.id, u])),
    [workspaceUsers],
  );

  // Parse initial tab from URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const validTabs: TaskTab[] = ["today", "upcoming", "overdue", "all", "mine", "unassigned", "completed"];
    if (tabParam && validTabs.includes(tabParam as TaskTab)) {
      setTab(tabParam as TaskTab);
    }
  }, []);

  // Keep selected task in sync with updated data
  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks, selectedTask]);

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

  function handleSelectTask(task: Task) {
    setSelectedTask((prev) => (prev?.id === task.id ? null : task));
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <ProjectsSidebar
        selectedProject={selectedProject}
        onSelect={(id) => {
          setSelectedProject(id);
          setSelectedTask(null);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-4 pt-4 pb-2 border-b border-border shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setSelectedTask(null);
              }}
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
          <QuickCapture onAdd={handleAdd} />
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
                <TaskRow
                  key={task.id}
                  task={task}
                  onSelect={handleSelectTask}
                  selectedId={selectedTask?.id}
                  userMap={userMap}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel (desktop) or modal (mobile) */}
      {selectedTask && (
        <div className="hidden md:flex">
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            userMap={userMap}
          />
        </div>
      )}

      {/* Mobile detail modal overlay */}
      {selectedTask && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex flex-col animate-in fade-in slide-in-from-bottom">
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            userMap={userMap}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: TaskTab }) {
  const messages: Record<TaskTab, { title: string; sub: string }> = {
    today: { title: "Nothing due today", sub: "Add a task above to get started." },
    upcoming: { title: "No upcoming tasks", sub: "You're all caught up!" },
    overdue: { title: "No overdue tasks", sub: "Great work keeping on top of things." },
    all: { title: "No tasks yet", sub: "Add your first task above." },
    mine: { title: "No tasks assigned to you", sub: "Tasks assigned to you will appear here." },
    unassigned: { title: "No unassigned tasks", sub: "All tasks have been assigned." },
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

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Trash2, Edit2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "@/hooks/useToast";
import { useQuoTasks, type QuoTask } from "@/hooks/useQuoTasks";

export function QuoTaskList() {
  const { loading, error, getTasks, createTask, completeTask, reopenTask, deleteTask } = useQuoTasks();
  const [tasks, setTasks] = useState<QuoTask[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const loadTasks = async () => {
    try {
      const result = await getTasks(cursor);
      setTasks((prev) => (cursor ? [...prev, ...result.tasks] : result.tasks));
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({ title: "Error", description: "Task title is required" });
      return;
    }

    try {
      await createTask(newTaskTitle, { description: newTaskDescription || undefined });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setShowCreateDialog(false);
      setCursor(undefined);
      await loadTasks();
      toast({ title: "Success", description: "Task created" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    }
  };

  const handleToggleTask = async (task: QuoTask) => {
    try {
      if (task.status === "completed") {
        await reopenTask(task.id);
      } else {
        await completeTask(task.id);
      }
      setCursor(undefined);
      await loadTasks();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setCursor(undefined);
      await loadTasks();
      toast({ title: "Success", description: "Task deleted" });
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask} disabled={loading}>
                {loading ? <LoadingSpinner /> : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading && tasks.length === 0 ? (
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <button
                onClick={() => handleToggleTask(task)}
                className="mt-1 flex-shrink-0"
              >
                {task.status === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium ${
                    task.status === "completed" ? "line-through text-gray-500" : ""
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                )}
                {task.dueDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                onClick={() => handleDeleteTask(task.id)}
                className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No tasks yet. Create one to get started!
            </div>
          )}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={loadTasks}
              disabled={loading}
            >
              {loading ? <LoadingSpinner /> : "Load More"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

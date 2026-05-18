'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { useBusinessStore } from '@/store/business';
import { formatDate } from '@/lib/utils';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'done';

interface Task {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  created_by_ai: boolean;
  created_at: string;
}

const PRIORITY_COLOR: Record<TaskPriority, 'secondary' | 'info' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const DEFAULT_FORM = { title: '', description: '', priority: 'medium' as TaskPriority, due_date: '' };

export default function TasksPage() {
  const { activeBusiness } = useBusinessStore();
  const businessId = activeBusiness?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const supabase = createClient();

  const loadTasks = useCallback(async () => {
    if (!businessId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks((data as Task[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, filter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate() {
    if (!businessId || !form.title.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        business_id: businessId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: 'todo',
        due_date: form.due_date || null,
        created_by_ai: false,
      });
      if (error) throw error;
      toast.success('Task created');
      setShowCreate(false);
      setForm(DEFAULT_FORM);
      await loadTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleCycleStatus(task: Task) {
    const nextStatus = NEXT_STATUS[task.status];
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', task.id);
      if (error) throw error;
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      toast.success('Task deleted');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    }
  }

  const grouped: Record<TaskStatus, Task[]> = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  return (
    <div>
      <Header
        title="Tasks"
        description="Manage your to-do list"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add task
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="todo">To do</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(
              [
                ['todo', 'To Do'],
                ['in_progress', 'In Progress'],
                ['done', 'Done'],
              ] as [TaskStatus, string][]
            ).map(([status, label]) => (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {grouped[status].length}
                  </Badge>
                </div>
                {grouped[status].length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                      No tasks
                    </CardContent>
                  </Card>
                ) : (
                  grouped[status].map(task => (
                    <Card key={task.id} className="group">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => handleCycleStatus(task)}
                            className="mt-0.5 shrink-0"
                            title="Cycle status"
                          >
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : task.status === 'in_progress' ? (
                              <Clock className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                task.status === 'done' ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            title="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={PRIORITY_COLOR[task.priority]} className="text-[10px]">
                            {task.priority}
                          </Badge>
                          {task.due_date && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.created_by_ai && (
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              <Sparkles className="h-2.5 w-2.5 mr-1" />AI
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={showCreate}
        onOpenChange={open => {
          setShowCreate(open);
          if (!open) setForm(DEFAULT_FORM);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!form.title.trim() || creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
